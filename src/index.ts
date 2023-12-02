import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { scrape } from "./scrape";

const app = new Hono();

app.get(
  "/",
  zValidator(
    "query",
    z.object({
      url: z.string().url(),
      html: z.union([z.literal("true"), z.literal("false")]).optional(),
    })
  ),
  async (c) => {
    let url = c.req.query("url")!;
    const htmlParam = c.req.query("html") || false;

    const urlHostname = new URL(url).hostname;
    const maxChars = Number(c.req.query("maxChars") || 500);

    try {
      if (urlHostname.includes("twitter.com")) {
        return c.json(await handleTwitter(url, maxChars));
      } else if (urlHostname.includes("youtube.com") || urlHostname.includes("youtu.be")) {
        return c.json(await handleYoutube(url, maxChars));
      } else {
        const page = await scrape({ url, markdown: true, maxChars });
        if (page) {
          const meta = await fetchAndParseMetaTags(page.html, maxChars);
          if (urlHostname.includes("news.ycombinator.com")) {
            handleHN(page, meta);
          }
          return c.json({ 
            html: htmlParam ? page.html : undefined,
            textContent: page.textContent, 
            meta 
          });
        } else {
          return c.json({ textContent: null, error: "No page content found for " + url });
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        return c.json({ textContent: null, error: e.message });
      } else {
        return c.json({ textContent: null, error: "An unknown error occurred" });
      }
    }
  }
);


app.get(
  "/enhance",
  zValidator(
    "query",
    z.object({
      str: z.string()
    })
  ),
  async (c) => {
    let str = c.req.query("str")!;
    // TODO: IMPLEMENT string replace
    return c.text(str)
  }
);

export default app;

function handleHN(page: { html: string; textContent: string; }, metaObject: Record<string, string>) {
  // Regex for Score
  const scoreRegex = /<span class="score"[^>]*>(\d+) points<\/span>/;
  const scoreMatch = page.html.match(scoreRegex);
  const score = scoreMatch ? scoreMatch[1] : null;

  // Regex for HNUser
  const userRegex = /<a href="user\?id=[^"]+" class="hnuser">([^<]+)<\/a>/;
  const userMatch = page.html.match(userRegex);
  const hnuser = userMatch ? userMatch[1] : null;

  // Regex for Titleline Href
  const articleUrlRegex = /<span class="titleline"><a href="([^"]+)"/;
  const articleUrlMatch = page.html.match(articleUrlRegex);
  const articleUrl = articleUrlMatch ? articleUrlMatch[1] : null;

  // console.log("Score:", score);
  // console.log("HNUser:", hnuser);
  // console.log("articleUrl Href:", articleUrlHref);
  metaObject["HackerNews"] = JSON.stringify({ score, hnuser, articleUrl });
}


async function handleTwitter(url: string, maxChars: number) {
  url = url.replace("twitter.com", "fxtwitter.com");
  const response = await fetch(url, {
    headers: { "User-Agent": "curl/123" }, // intentionally duplicated in case we need to change this
  });
  console.log('hi', url)
  const htmlContent = await response.text();
  const metaObject = await fetchAndParseMetaTags(htmlContent, maxChars);
  console.log(metaObject)
  return { textContent: JSON.stringify(metaObject) };
}

async function handleYoutube(url: string, maxChars: number) {
  const response = await fetch(url, {
    headers: { "User-Agent": "curl/123" }, // intentionally duplicated in case we need to change this
  });
  const htmlContent = await response.text();
  const metaObject = await fetchAndParseMetaTags(htmlContent, maxChars);
  return { textContent: JSON.stringify(metaObject) };
}



function fetchAndParseMetaTags(htmlContent: string, maxChars: number): Record<string, string> {
      const metaTagRegex = /<meta[^>]+>/gi;
      const metaTags = htmlContent.match(metaTagRegex);

      let metaObject = {} as Record<string, string>;

      if (metaTags) {
          metaTags.forEach(tag => {
              const propertyMatch = tag.match(/property="([^"]+)"|name="description"/);
              const contentMatch = tag.match(/content="([^"]+)"/);
              
              if (propertyMatch && contentMatch) {
                  const property = propertyMatch[1];
                  const content = contentMatch[1];
                  // full list looks like this: "og:site_name: YouTube og:url: https://www.youtube.com/watch?v=F5gxtgrRhqc og:title: Endless Runner Games with FlutterFlow: Players &amp; Obstacles Movement og:image: https://i.ytimg.com/vi/F5gxtgrRhqc/maxresdefault.jpg og:image:width: 1280 og:image:height: 720 og:description: Let&#39;s create a fun endless runner game, like Chrome Dino but with a cool Mario theme, all in FlutterFlow and without any custom code yet. You&#39;re watching a m... al:ios:app_store_id: 544007664 al:ios:app_name: YouTube al:ios:url: vnd.youtube://www.youtube.com/watch?si=50KvdOy8pBLSBL6X&amp;v=F5gxtgrRhqc&amp;feature=youtu.be&amp;feature=applinks al:android:url: vnd.youtube://www.youtube.com/watch?si=50KvdOy8pBLSBL6X&amp;v=F5gxtgrRhqc&amp;feature=youtu.be&amp;feature=applinks al:web:url: http://www.youtube.com/watch?si=50KvdOy8pBLSBL6X&amp;v=F5gxtgrRhqc&amp;feature=youtu.be&amp;feature=applinks og:type: video.other og:video:url: https://www.youtube.com/embed/F5gxtgrRhqc og:video:secure_url: https://www.youtube.com/embed/F5gxtgrRhqc og:video:type: text/html og:video:width: 1280 og:video:height: 720 al:android:app_name: YouTube al:android:package: com.google.android.youtube og:video:tag: No Code App Builder fb:app_id: 87741124305 "
                  // so went for a whitelist approach
                  const propertyList = [
                    "og:title",
                    "og:image",
                    "description",
                    "og:description" // surprisingly, sufficient for twitter too http://127.0.0.1:8787/?url=https://twitter.com/Aella_Girl/status/1730741788686581864
                  ]
                  if (property !== undefined && propertyList.includes(property) && content !== undefined) {
                    metaObject[property] = content.slice(0, maxChars);
                }
              }
          });

          console.log('Parsed Meta Tags:', metaObject);
      } else {
        console.log('No Meta Tags Found');
      }

      if (!metaObject["og:title"]) {
        const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          metaObject["title"] = titleMatch[1].slice(0, maxChars);
        }
      }
      
      return metaObject;
}
