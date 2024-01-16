import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import md5 from "md5";
import { getDetectedType, processSingleURL } from "./utilities";

const CACHE_TTL = 86400000; // one day

export type Bindings = {
  REQUEST_CACHE: KVNamespace;
  TELEMETRY: AnalyticsEngineDataset;
  ENVIRONMENT: String;
};
const app = new Hono<{ Bindings: Bindings }>();



app.get(
  "/",
  zValidator(
    "query",
    z.object({
      url: z.string().url(),
      // maxChars: z.number().optional(), // for some reason this doesnt work cant be bothered to solve
      html: z.union([z.literal("true"), z.literal("false")]).optional(),
      no_cache: z.union([z.literal("true"), z.literal("false")]).optional(),
    })
  ),
  async (c) => {
    const env = c.env;
    let url = c.req.query("url")!;
    const htmlParam = c.req.query("html") ? true : false;
    const nocache = c.req.query("no_cache") ? true : false;
    const maxChars = Number(c.req.query("maxChars") || 1000);
    const detectedType = getDetectedType(url);
    const options = {
      detectedType,
      htmlParam,
      nocache,
      maxChars,
      env,
    };
    const { statusCode, ...res } = await processSingleURL(url, options);

    if (env.ENVIRONMENT === "production") {
      env.TELEMETRY.writeDataPoint({
        blobs: [url, detectedType, "/"],
        doubles: [statusCode],
        indexes: ["request_info"],
      });
    } else {
      console.log({
        blobs: [url, detectedType, "/"],
        doubles: [statusCode],
        indexes: ["request_info"],
      });
    }
    return c.json(res);
  }
);

// http://localhost:8787/enhance?str=i%20really%20enjoyed%20https://www.youtube.com/watch?v=yi8Cq2SZy48%20and%20https://twitter.com/labenz/status/1630284912853917697%20today.
// also supported: &html=true attribute and &maxChars=1000
app.get(
  "/enhance",
  zValidator(
    "query",
    z.object({
      str: z.string(),
      // maxChars: z.number().optional(), // for some reason this doesnt work cant be bothered to solve
      // html: z.union([z.literal("true"), z.literal("false")]).optional(),
      // returnJSON: z.union([z.literal("true"), z.literal("false")]).optional(),
      no_cache: z.union([z.literal("true"), z.literal("false")]).optional(),
    })
  ),
  async (c) => {
    const env = c.env;
    let str = c.req.query("str")!;
    const returnJSONParam = c.req.query("returnJSON") ? true : false;
    const htmlParam = c.req.query("html") ? true : false;
    const nocache = c.req.query("no_cache") ? true : false;
    const exposeErrors = c.req.query("exposeErrors") ? true : false;
    const maxChars = Number(c.req.query("maxChars") || 1000);
    const options = {
      htmlParam,
      nocache,
      silenceErr: !exposeErrors,
      maxChars,
      env,
    };

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = str.match(urlRegex);
    const results: Record<string, any> = {};

    const cacheKey = md5(str);
    let response;
    if (!nocache) {
      // Check the cache
      response = await env.REQUEST_CACHE.get(cacheKey);
      if (response) {
        return c.json(response); // Return the cached response
      }
    }

    if (urls) {
      for (const url of urls) {
        const detectedType = getDetectedType(new URL(url).hostname);
        let status;
        // intentionally serial so as not to spam.
        try {
          const { statusCode, ...data } = await processSingleURL(url, {
            detectedType,
            ...options,
          });
          status = statusCode || 500; // default to 500 status code if no statuscode supplied? should be rare
          if (data.silentError) continue;
          results[url] = data;

		  const log = {
              blobs: ["/enhance", url, detectedType],
              doubles: [statusCode],
              indexes: ["request_info"],
          }
          if (env.ENVIRONMENT === "production") {
            env.TELEMETRY.writeDataPoint(log);
          } else {
            console.log(log);
          }
        } catch (error) {
	          console.error(`Failed to process URL: ${url}`, error);
	          results[url] = { error: `Failed to process URL: ${url}` };
						log.doubles = [log.doubles[0] || 500] // overwrite with 500 inside of this catch
	          if (env.ENVIRONMENT === "production") {
	            env.TELEMETRY.writeDataPoint(log);
	          } else {
	            console.log(log);
	          }
          }
        }
      }
    }
    if (returnJSONParam !== true) {
      str = str.replace(urlRegex, (url) => {
        const result = results[url];

        // Check if result exists and is not a silent error
        if (result && !result.silentError) {
          return `${url}${` <<<${
            result.detectedType
              ? JSON.stringify(result.metaObject)
              : result.textContent
          }>>>`}`;
        } else {
          // For silent errors or missing results, return the original URL without modification
          return url;
        }
      });
      await env.REQUEST_CACHE.put(
        cacheKey,
        JSON.stringify({ str, links: results }),
        { expirationTtl: CACHE_TTL }
      );
      return c.json({
        str,
        links: results,
      });
    }

    await env.REQUEST_CACHE.put(cacheKey, JSON.stringify(results), {
      expirationTtl: CACHE_TTL,
    });
    return c.json(results);
  }
);

export default app;

