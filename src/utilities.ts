import { getParser } from "./parsers";

import type { ScrapeResult, ParserOptions } from "./parsers";


export type DetectedType = "YouTube" | "Twitter" | "GitHub" | "HN" | "Unknown";

export async function processSingleURL(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const parser = getParser(options.detectedType);

  return parser(url, options);
}


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

export function handleError(e: Error) {
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

export function parseMetaTagsFromHTML(
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

  // replace newlines with spaces from titles and descriptions, which sometimes happens and Is Bad
  if (metaObject["title"]) {
    metaObject["title"] = metaObject["title"].replace(/\n/g, ' ');
  }
  if (metaObject["description"]) {
    metaObject["description"] = metaObject["description"].replace(/\n/g, ' ');
  }

  return metaObject;
}

export class ScraperError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}