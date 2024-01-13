import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "./turndown";

import md5 from 'md5'
import type { Bindings } from "hono/types";
import type { ParserOptions } from "src";

const CACHE_TTL = 86400000 // one day


export const scrape = async (url: string, options: ParserOptions) => {
  const {
    maxChars = 1000,
    silenceErr,
    nocache = false,
    headers,
    env
  } = options;
  const cacheKey = md5(url)
  let response
  if (!nocache) {
    // Check the cache
    response = await env.REQUEST_CACHE.get(cacheKey);
    if (response) {
      return JSON.parse(response); // Return the cached response
    }
  }
  response = await fetch(url, {
    headers,
  });
  // Check if response is valid for all cases
  if (!response || !response.ok) {
    console.log('!!!!\n',silenceErr,'!!!!\n')
    if (silenceErr) return;

    return { textContent: null, error: "Invalid or no response" };
  }
  const html = await response.text();

  if (!isValidContent(html)) {
    if (silenceErr) return;

    return { textContent: null, error: "Invalid or no content" };
  }
  const article = extract(html);
  let textContent = null;
  if (article) {
    textContent = convertToMarkdown(article.content).slice(0, maxChars);
  }

  await env.REQUEST_CACHE.put(cacheKey, JSON.stringify({ html, textContent, statusCode: response.status }), { expirationTtl: CACHE_TTL });


  return { html, textContent, statusCode: response.status };
};

const extract = (html: string) => {
  var doc = parseHTML(html);
  let reader = new Readability(doc.window.document);
  return reader.parse();
};

const convertToMarkdown = (html: string) => {
  const doc = parseHTML(html);
  let mainElement = doc.window.document;
  if (doc.window.document.querySelector("main")) {
    mainElement = doc.window.document.querySelector("main");
  } else if (doc.window.document.querySelector("article")) {
    mainElement = doc.window.document.querySelector("article");
  }
  const turndown = new TurndownService();
  return turndown.turndown(mainElement);
};

const isValidContent = (htmlContent: string): Boolean => {
  // Check if content is not empty
  if (!htmlContent || htmlContent.trim() === "") return false;

  // Check for the presence of basic HTML structures
  const hasBasicHtmlStructure = /<html.*>.*<\/html>/is.test(htmlContent);
  if (!hasBasicHtmlStructure) return false;

  // Check for specific error messages in the content
  const knownErrorMessages = [
    "Sorry, that post doesn't exist", // twitter
    "This video isn't available anymore", // youtube
  ];
  return !knownErrorMessages.some((errorMessage) =>
    htmlContent.includes(errorMessage),
  );
};
