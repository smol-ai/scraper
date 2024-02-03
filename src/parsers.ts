import { scrape as fetchAndScrape } from "./scrape";
import { parseMetaTagsFromHTML, handleError, ScraperError } from "./utilities";
import { handleHN } from "./specificHandlers";

import type { DetectedType } from "./utilities";
import type { Bindings } from "src";

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

export function getParser(detectedType: string): ParserFunction {
  switch (detectedType) {
    case "YouTube":
      return parseYouTube;
    case "Twitter":
      return parseTwitter;
    case "GitHub":
      return parseGitHub;
    case "Discord":
      return parseDiscord;
    case "HN":
      return parseHN;
    default:
      return defaultParser; 
  }
}


// discord doesnt provide jack shit so just refuse to process it and treat it as an error
async function parseDiscord(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  return {
    textContent: null,
    error: 'Discord is not supported - doesnt offer ANY metadata whatsoever',
    statusCode: 300,
  }
}

async function defaultParser(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const {
    maxChars = 1000,
    htmlParam = false,
    silenceErr,
    detectedType,
  } = options;
  try {
    let page = await fetchAndScrape(url, options);

    if (!page || !page.html) {
      if (silenceErr) {
        return {
          textContent: null,
          statusCode: page?.statusCode || 404,
          error: `No page content found for request: ${url}`,
          silentError: true,
        };
      } else {
        throw new ScraperError(
          `No page content found for request: ${url}`,
          404
        );
      }
    }

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
      if (silenceErr) {
        return {
          textContent: null,
          statusCode: page?.statusCode || 404,
          error: `No page content found for request: ${url}`,
          silentError: true,
        };
      } else {
        throw new ScraperError(
          `No page content found for request: ${url}`,
          404
        );
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
  url = url
    .replace("https://twitter.com", "https://fxtwitter.com")
    .replace("https://vxtwitter.com", "https://fxtwitter.com")
    .replace("https://fixupx.com", "https://fxtwitter.com")
    .replace("https://x.com", "https://fxtwitter.com");
  const {
    maxChars = 1000,
    htmlParam = false,
    detectedType,
    silenceErr,
    headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    },
  } = options;

  try {
    let page = await fetchAndScrape(url, { headers, ...options });
    if (!page || !page.html) {
      if (silenceErr) {
        return {
          textContent: null,
          statusCode: page?.statusCode || 404,
          error: `No page content found for request: ${url}`,
          silentError: true,
        };
      } else {
        throw new ScraperError(
          `No page content found for request: ${url}`,
          404
        );
      }
    }

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
      if (silenceErr) {
        return {
          textContent: null,
          statusCode: page?.statusCode || 404,
          error: `No page content found for request: ${url}`,
          silentError: true,
        };
      } else {
        throw new ScraperError(
          `No page content found for request: ${url}`,
          404
        );
      }
    }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    metaObject["detectedType"] = detectedType;
    const textContent = JSON.stringify(metaObject);

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

async function parseHN(
  url: string,
  options: ParserOptions
): Promise<ScrapeResult> {
  const {
    maxChars = 1000,
    htmlParam = false,
    detectedType,
    silenceErr,
    headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    },
  } = options;

  try {
    let page = await fetchAndScrape(url, { headers, ...options });
    if (!page || !page.html) {
      if (silenceErr) {
        return {
          textContent: null,
          statusCode: page?.statusCode || 404,
          error: `No page content found for request: ${url}`,
          silentError: true,
        };
      } else {
        throw new ScraperError(
          `No page content found for request: ${url}`,
          404
        );
      }
    }

    let metaObject = parseMetaTagsFromHTML(page.html, maxChars);
    handleHN(page, metaObject);
    metaObject["detectedObject"] = detectedType;

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
