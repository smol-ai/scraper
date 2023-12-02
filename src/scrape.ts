import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "./turndown";

export const scrape = async ({
  url,
  markdown,
  maxChars
}: {
  url: string;
  markdown: boolean;
  maxChars: number
}) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "\"Google Chrome\";v=\"119\", \"Chromium\";v=\"119\", \"Not?A_Brand\";v=\"24\"",
    },
  });
  const html = await response.text();
  const article = extract(html);

  if (article == null) {
    return null;
  }

  const textContent = convertToMarkdown(article.content).slice(0, maxChars);
  return { html, textContent };
};

const extract = (html: string) => {
  var doc = parseHTML(html);
  let reader = new Readability(doc.window.document);
  return reader.parse();
};

const convertToMarkdown = (html: string) => {
  const turndown = new TurndownService();
  const doc = parseHTML(html);
  return turndown.turndown(doc.window.document);
};
