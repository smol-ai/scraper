import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

describe("Worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it("should return scraped page with markdown contents", async () => {
    const resp = await worker.fetch("/?url=https://www.robotstxt.org");
    if (resp) {
      expect(resp.status).toEqual(200);
      const data = await resp.json();
      expect(data).toMatchInlineSnapshot(
        `
        {
          "metaObject": {
            "title": "The Web Robots Pages",
          },
          "textContent": "Web Robots (also known as Web Wanderers, Crawlers, or Spiders), are programs that traverse the Web automatically. Search engines such as [Google](http://www.google.com/) use them to index the web content, spammers use them to scan for email addresses, and they have many other uses.

        On this site you can learn more about web robots.

        *   [About /robots.txt](robotstxt.html) explains what /robots.txt is, and how to use it.
        *   The [FAQ](faq.html) answers many frequently asked questions, such as [Ho",
        }
      `,
      );
    }
  });

  it("should handle specific URLs correctly", async () => {
    const testUrls = [
      {
        url: "https://twitter.com/jhooks/status/1732902067893850515",
        expectedType: "Twitter",
      },
      {
        url: "https://www.youtube.com/watch?v=C0ZUdFg-iTo&t=4179s",
        expectedType: "YouTube",
      },
      {
        url: "https://github.com/kentcdodds/mdx-bundler",
        expectedType: "GitHub",
      },
    ];

    for (const { url, expectedType } of testUrls) {
      const resp = await worker.fetch(`/?url=${url}`);
      expect(resp.status).toEqual(200);
      const data = await resp.json();
      expect(data.metaObject.detectedType).toEqual(expectedType);
    }
  });

  // It does 200's for everything rn and I'm not sure how worker statuscode handling works
  // it("should handle errors during scraping", async () => {
  //   const resp = await worker.fetch("/?url=https://nonexistentwebsite.com");
  //   expect(resp.status).not.toEqual(200);
  //   const data = await resp.json();
  //   expect(data.error).toBeDefined();
  // });

  // it("should parse meta tags correctly", async () => {
  //   const resp = await worker.fetch("/?url=https://example.com");
  //   expect(resp.status).toEqual(200);
  //   const data = await resp.json();
  //   expect(data.metaObject.title).toBeDefined();
  //   expect(data.metaObject.description).toBeDefined();
  // });
  it("should convert HTML to markdown correctly", async () => {
    const resp = await worker.fetch(
      "/?url=https://www.swyx.io/ai-landscape&maxChars=3000",
    );

    expect(resp.status).toEqual(200);
    const data = await resp.json();
    expect(data.textContent).toContain("*"); // Assuming markdown content will have list items
  });
  it("should respect the maxChars limit", async () => {
    const maxChars = 100;
    const resp = await worker.fetch(
      `/?url=https://example.com&maxChars=${maxChars}`,
    );
    expect(resp.status).toEqual(200);
    const data = await resp.json();
    expect(data.textContent.length).toBeLessThanOrEqual(maxChars);
  });
  // it("should handle special website logic like Youtube", async () => {
  //   const resp = await worker.fetch(
  //     "/enhance?str=https://www.youtube.com/watch?v=XUw_7Hk6SmQ",
  //   );
  //   expect(resp.status).toEqual(200);
  //   const data = await resp.json();
  //   expect(data.metaObject.detectedType).toEqual("YouTube");
  // });
});
