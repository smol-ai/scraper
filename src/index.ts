import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { scrape as fetchAndScrape } from "./scrape";
import md5 from "md5";
import { handleHN } from "./specificHandlers";

declare const ENVIRONMENT: string;
// TODO: EXPLICITLY DEFINE ENVIRONMENT ACROSS ALL ENVS

const CACHE_TTL = 86400000; // one day

type Bindings = {
  REQUEST_CACHE: KVNamespace;
  TELEMETRY: AnalyticsEngineDataset;
  ENVIRONMENT: String;
};
const app = new Hono<{ Bindings: Bindings }>();

class ScraperError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

type ParserFunction = (
  url: string,
  options: ParserOptions
) => Promise<ScrapeResult>;

export interface ScrapeResult {
  html?: string;
  textContent: string | null;
  metaObject?: any;
  statusCode: number;
  error?: string;
  silentError?: boolean;
}
export interface ParserOptions {
  detectedType: DetectedType;
  maxChars?: number;
  htmlParam?: boolean;
  silenceErr?: boolean;
  nocache?: boolean;
  env: Bindings;
  headers?: Record<string, string>;
}

function getParser(detectedType: string): ParserFunction {
  switch (detectedType) {
    case "YouTube":
      return parseYouTube;
    case "Twitter":
      return parseTwitter;
    case "GitHub":
      return parseGitHub;
    case "HN":
      return parseHN;
    // Add more cases as necessary
    default:
      return defaultParser; // A general parser for unknown types
  }
}

async function defaultParser(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const { maxChars = 1000, htmlParam = false, detectedType } = options;
  try {
    let page = await fetchAndScrape(url, options);

    // if (!page || !page.html) {
    // throw new ScraperError(`No page content found for request: ${url}`, 404);
    // }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    metaObject["detectedType"] = detectedType;

    return {
      html: htmlParam ? page.html : undefined,
      textContent: page.textContent,
      metaObject,
      statusCode: page.statusCode,
    };
  } catch (e) {
    return handleError(e as Error);
  }
}

async function parseYouTube(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const {
    maxChars = 1000,
    htmlParam = false,
    silenceErr,
    detectedType,
    headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    },
  } = options;

  try {
    let page = await fetchAndScrape(url, { headers, ...options });

    if (!page || !page.html) {
      console.log("~~~~~~~~~~~~~SILENCE ERR:", silenceErr);
      if (silenceErr) {
        return {
          textContent: null,
          statusCode: page?.statusCode || 404,
          error: `No page content found for request: ${url}`,
          silentError: true,
        };
      } else {
        throw new ScraperError(`No page content found for request: ${url}`, 404);
      }
    }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    let textContent = `YouTube video titled: "${metaObject.title}" (Description: ${metaObject.description})`;
    metaObject["detectedType"] = detectedType;

    return {
      html: htmlParam ? page.html : undefined,
      textContent,
      metaObject,
      statusCode: page.statusCode,
    };
  } catch (e) {
    return handleError(e as Error);
  }
}
async function parseTwitter(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  // Modify the URL for Twitter-specific scraping
  url = url
    .replace("https://twitter.com", "https://fxtwitter.com")
    .replace("https://vxtwitter.com", "https://fxtwitter.com")
    .replace("https://x.com", "https://fxtwitter.com");
  const {
    maxChars = 1000,
    htmlParam = false,
    detectedType,
    headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    },
  } = options;

  try {
    let page = await fetchAndScrape(url, { headers, ...options });
    // if (!page || !page.html) {
    // throw new ScraperError(`No page content found for request: ${url}`, 404);
    // }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    metaObject["title"] = "Tweet from " + metaObject["title"];
    const usernameRegex = /@(\w+)/;
    const usernameMatch = (metaObject["title"] as string).match(usernameRegex);
    const username = usernameMatch ? usernameMatch[1] || "unknown" : "unknown";
    metaObject["specialMeta"] = { username };
    let textContent = `@${username}: ${metaObject.description}`;

    metaObject["detectedType"] = detectedType;
    return {
      html: htmlParam ? page.html : undefined,
      textContent,
      metaObject,
      statusCode: page.statusCode,
    };
  } catch (e) {
    return handleError(e as Error);
  }
}

async function parseGitHub(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const {
    maxChars = 1000,
    htmlParam,
    detectedType,
    headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    },
  } = options;

  try {
    let page = await fetchAndScrape(url, { headers, ...options });
    if (!page || !page.html) {
      throw new ScraperError(`No page content found for request: ${url}`, 404);
    }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    // Add any GitHub-specific processing here

    metaObject["detectedType"] = detectedType;
    return {
      html: htmlParam ? page.html : undefined,
      textContent: page.textContent,
      metaObject,
      statusCode: page.statusCode,
    };
  } catch (e) {
    return handleError(e as Error);
  }
}

async function parseHN(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const {
    maxChars = 1000,
    htmlParam = false,
    detectedType,
    headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    },
  } = options;

  try {
    let page = await fetchAndScrape(url, { headers, ...options });
    // if (!page || !page.html) {
    // throw new ScraperError(`No page content found for request: ${url}`, 404);
    // }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    handleHN(page, metaObject); // Assuming handleHN is defined elsewhere

    return {
      html: htmlParam ? page.html : undefined,
      textContent: page.textContent,
      metaObject,
      statusCode: page.statusCode,
    };
  } catch (e) {
    return handleError(e as Error);
  }
}

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
        blobs: [url, detectedType],
        doubles: [statusCode],
        indexes: ["request_info"],
      });
    } else {
      console.log({
        blobs: [url, detectedType],
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
        // intentionally serial so as not to spam.
        try {
          const { statusCode, ...data } = await processSingleURL(url, {
            detectedType,
            ...options,
          });
          console.log("~~~",data,"~~~")
          if (data.silentError) continue;
          results[url] = data;

          if (env.ENVIRONMENT === "production") {
            env.TELEMETRY.writeDataPoint({
              blobs: [url, detectedType],
              doubles: [statusCode],
              indexes: ["request_info"],
            });
          } else {
            console.log({
              blobs: [url, detectedType],
              doubles: [statusCode],
              indexes: ["request_info"],
            });
          }
        } catch (error) {
          console.error(`Failed to process URL: ${url}`, error);
          results[url] = { error: `Failed to process URL: ${url}` };

          if (env.ENVIRONMENT === "production") {
            env.TELEMETRY.writeDataPoint({
              blobs: [url, "", "error"],
              doubles: [results[url].statusCode],
              indexes: ["request_info"],
            });
          } else {
            console.log({
              blobs: [url, detectedType],
              doubles: [results[url].statusCode],
              indexes: ["request_info"],
            });
          }
        }
      }
    }
    if (returnJSONParam !== true) {
      str = str.replace(urlRegex, (url) => {
        const result = results[url];
        console.log("!!!\n", result, "!!!\n")

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

async function processSingleURL(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const parser = getParser(options.detectedType);

  return parser(url, options);
}

type DetectedType = "YouTube" | "Twitter" | "GitHub" | "HN" | "Unknown";

export function getDetectedType(hostname: string): DetectedType {
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return "YouTube";
  if (
    hostname.includes("twitter.com") ||
    hostname.includes("x.com") ||
    hostname.includes("fxtwitter.com") ||
    hostname.includes("vxtwitter.com")
  )
    return "Twitter";
  if (hostname.includes("github.com")) return "GitHub";
  if (hostname.includes("news.ycombinator.com")) return "HN";
  // Add more cases as necessary
  return "Unknown";
}

function handleError(e: Error) {
  if (e instanceof ScraperError) {
    return {
      textContent: null,
      error: e.message,
      statusCode: e.statusCode,
    };
  } else if (e instanceof Error) {
    return {
      textContent: null,
      error: e.message,
      statusCode: 500,
    };
  } else {
    return {
      textContent: null,
      error: "An unknown error occurred",
      statusCode: 500,
    };
  }
}

function parseMetaTagsFromHTML(
  htmlContent: string,
  maxChars: number
): Record<string, string | Object> {
  const metaTagRegex = /<meta[^>]+>/gi;
  const metaTags = htmlContent.match(metaTagRegex);
  let metaObject = {} as Record<string, string>;

  if (metaTags) {
    metaTags.forEach((tag) => {
      const propertyMatch = tag.match(/property="([^"]+)"|name="description"/);
      const contentMatch = tag.match(/content="([^"]+)"/);

      if (propertyMatch && contentMatch) {
        const property = propertyMatch[1];
        const content = contentMatch[1];

        // Dec 2: originally went with this approach but realized we wanted noramlized title/image/description only
        // // full list looks like this: "og:site_name: YouTube og:url: https://www.youtube.com/watch?v=F5gxtgrRhqc og:title: Endless Runner Games with FlutterFlow: Players &amp; Obstacles Movement og:image: https://i.ytimg.com/vi/F5gxtgrRhqc/maxresdefault.jpg og:image:width: 1280 og:image:height: 720 og:description: Let&#39;s create a fun endless runner game, like Chrome Dino but with a cool Mario theme, all in FlutterFlow and without any custom code yet. You&#39;re watching a m... al:ios:app_store_id: 544007664 al:ios:app_name: YouTube al:ios:url: vnd.youtube://www.youtube.com/watch?si=50KvdOy8pBLSBL6X&amp;v=F5gxtgrRhqc&amp;feature=youtu.be&amp;feature=applinks al:android:url: vnd.youtube://www.youtube.com/watch?si=50KvdOy8pBLSBL6X&amp;v=F5gxtgrRhqc&amp;feature=youtu.be&amp;feature=applinks al:web:url: http://www.youtube.com/watch?si=50KvdOy8pBLSBL6X&amp;v=F5gxtgrRhqc&amp;feature=youtu.be&amp;feature=applinks og:type: video.other og:video:url: https://www.youtube.com/embed/F5gxtgrRhqc og:video:secure_url: https://www.youtube.com/embed/F5gxtgrRhqc og:video:type: text/html og:video:width: 1280 og:video:height: 720 al:android:app_name: YouTube al:android:package: com.google.android.youtube og:video:tag: No Code App Builder fb:app_id: 87741124305 "
        // // so went for a whitelist approach
        // const propertyList = [
        //   "og:title",
        //   "og:image",
        //   "description",
        //   "og:description" // surprisingly, sufficient for twitter too http://127.0.0.1:8787/?url=https://twitter.com/Aella_Girl/status/1730741788686581864
        // ]
        // if (property !== undefined && propertyList.includes(property) && content !== undefined) {
        //   metaObject[property] = content.slice(0, maxChars);
        // }

        // Dec 2: so now we are just going for a manually curated approach:
        if (content === undefined) return; // early terminate since theres nothing to do here
        // title
        if (property === "og:title") {
          metaObject["title"] = content;
        }
        // description
        if (property === "og:description" || property === "description") {
          metaObject["description"] = content;
        }
        // og:image
        if (property === "og:image") {
          metaObject["image"] = content;
        }
      }
    });

    console.log("Parsed Meta Tags:", metaObject);
  } else {
    console.log("No Meta Tags Found");
  }
  // fallback to <title> in case og:title doesnt exist, as is the case with hacker news
  if (!metaObject["title"]) {
    const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      metaObject["title"] = titleMatch[1].slice(0, maxChars);
    }
  }

  return metaObject;
}
