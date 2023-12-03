import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { scrape as fetchAndScrape } from "./scrape";
import { handleHN } from "./specificHandlers";

const app = new Hono();

app.get(
  "/",
  zValidator(
    "query",
    z.object({
      url: z.string().url(),
      // maxChars: z.number().optional(), // for some reason this doesnt work cant be bothered to solve
      html: z.union([z.literal("true"), z.literal("false")]).optional(),
    })
  ),
  async (c) => {
    let url = c.req.query("url")!;
    const htmlParam = c.req.query("html") ? true : false;
    const maxChars = Number(c.req.query("maxChars") || 500);
    const res = await processSingleURL(url, maxChars, htmlParam);
    return c.json(res)
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
    })
  ),
  async (c) => {
    let str = c.req.query("str")!;
    const htmlParam = c.req.query("html") ? true : false;
    const returnJSONParam = c.req.query("returnJSON") ? true : false;
    const maxChars = Number(c.req.query("maxChars") || 500);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = str.match(urlRegex);
    const results: Record<string, any> = {};

    if (urls) {
      for (const url of urls) { // intentionally serial so as not to spam.
        try {
          const data = await processSingleURL(url, maxChars, htmlParam);
          results[url] = data;
        } catch (error) {
          console.error(`Failed to process URL: ${url}`, error);
          results[url] = { error: `Failed to process URL: ${url}` };
        }
      }
    }

    if (returnJSONParam !== true) {
      str = str.replace(urlRegex, (url) => {
        if (results[url]) {
          const result = results[url]
          return `${url}${` <<<${result.detectedType ? JSON.stringify(result.metaObject) : result.textContent}>>>`}`;
        } else {
          return url
        }
        
      });
      return c.text(str)
    }


    return c.json(results);
  }
);

export default app;



async function processSingleURL(url: string, maxChars: number, htmlParam: boolean) {
  const urlHostname = new URL(url).hostname;

  try {
    if (urlHostname.includes("twitter.com")) {
      url = url.replace("twitter.com", "fxtwitter.com");
      const response = await fetch(url, {
        headers: { "User-Agent": "curl/123" }, // intentionally duplicated in case we need to change this
      });
      const htmlContent = await response.text();
      const metaObject = await parseMetaTagsFromHTML(htmlContent, maxChars);
      metaObject["detectedType"] = "Twitter";
      return { html: htmlParam ? htmlContent : undefined, textContent: JSON.stringify(metaObject), metaObject };
    } else if (urlHostname.includes("youtube.com") || urlHostname.includes("youtu.be")) {
      const response = await fetch(url, {
        // headers: { "User-Agent": "curl/123" }, // intentionally duplicated in case we need to change this
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36", }
      });
      const htmlContent = await response.text();
      const metaObject = await parseMetaTagsFromHTML(htmlContent, maxChars);
      metaObject["detectedType"] = "YouTube";
      return { html: htmlParam ? htmlContent : undefined, textContent: JSON.stringify(metaObject), metaObject };
    } else {
      const page = await fetchAndScrape({ url, markdown: true, maxChars });
      if (page) {
        const meta = await parseMetaTagsFromHTML(page.html, maxChars);
        if (urlHostname.includes("news.ycombinator.com")) {
          handleHN(page, meta);
        }
        return {
          html: htmlParam ? page.html : undefined,
          textContent: page.textContent,
          meta
        };
      } else {
        return { textContent: null, error: "No page content found for " + url };
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      return { textContent: null, error: e.message };
    } else {
      return { textContent: null, error: "An unknown error occurred" };
    }
  }
}

function parseMetaTagsFromHTML(htmlContent: string, maxChars: number): Record<string, string> {
  const metaTagRegex = /<meta[^>]+>/gi;
  console.log('htmlContent', htmlContent)
  const metaTags = htmlContent.match(metaTagRegex);
  console.log('metaTags', metaTags)
  let metaObject = {} as Record<string, string>;

  if (metaTags) {
    metaTags.forEach(tag => {
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
        if (content === undefined) return // early terminate since theres nothing to do here
        // title
        if (property === "og:title") {
          metaObject["title"] = content
        }
        // description
        if (property === "og:description" || property === "description") {
          metaObject["description"] = content
        }
        // og:image
        if (property === "og:image") {
          metaObject["image"] = content
        }
      }
    });

    console.log('Parsed Meta Tags:', metaObject);
  } else {
    console.log('No Meta Tags Found');
  }
  console.log('metaObject', metaObject)

  // fallback to <title> in case og:title doesnt exist, as is the case with hacker news
  if (!metaObject["title"]) {
    const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      metaObject["title"] = titleMatch[1].slice(0, maxChars);
    }
  }

  return metaObject;
}
