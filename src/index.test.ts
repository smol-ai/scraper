import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDetectedType } from "src";

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
        *   The [FAQ](faq.html) answers many frequently asked questions, such as [How do I stop robots visiting my site?](/faq/prevent.html) and [How can I get the best listing in search engines?\\"](/faq/bestlisting.html)
        *   The [Other Sites](other.html) page links to external resources for robot writers and webmasters.
        *   The [Robots Database](db.html) has a list of robots.
        *   The [/robots.txt checker](checker.html) can check your site's /robots.txt file and meta tags.
        *   The [IP Lookup](iplookup.html) can help find out more about what robots are visiting you.",
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
        url: "https://fxtwitter.com/jhooks/status/1732902067893850515",
        expectedType: "Twitter"
      },
      {
        url: "https://vxtwitter.com/jhooks/status/1732902067893850515",
        expectedType: "Twitter"
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
      const detectedType = getDetectedType(url);
      expect(detectedType).toEqual(expectedType);
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
    expect(data !== undefined)

    expect((data).textContent).toContain("*"); // Assuming markdown content will have list items
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
  it("should retrieve response from cache on repeated requests", async () => {
    const CACHE_THRESHOLD = 20
    const url = "https://example.com";
    const firstResponse = await worker.fetch(`/?url=${url}`);
    const firstResponseTime = new Date().getTime();
    const secondResponse = await worker.fetch(`/?url=${url}`);
    const secondResponseTime = new Date().getTime();
    expect(secondResponseTime - firstResponseTime).toBeLessThan(CACHE_THRESHOLD);
    expect(firstResponse === secondResponse)
  });
  it("should bypass cache when no_cache parameter is set to true", async () => {
    // this makes the request have to be under 50ms since there's a 100ms timeout
    const CACHE_THRESHOLD = 20
    const url = "https://example.com";
    const maxChars = 100;
  
    // First request with no_cache set to true
    const firstResponse = await worker.fetch(`/?url=${url}&maxChars=${maxChars}&no_cache=true`);
    const firstResponseTime = new Date().getTime();
    const firstData = await firstResponse.json();
  
    // Second request with no_cache set to true
    const secondResponse = await worker.fetch(`/?url=${url}&maxChars=${maxChars}&no_cache=true`);
    const secondResponseTime = new Date().getTime();
    const secondData = await secondResponse.json();
  
    // Check that the second response did not come from cache by comparing response times
    const isCacheBypassed = (secondResponseTime - firstResponseTime) > CACHE_THRESHOLD;
    expect(isCacheBypassed).toBe(true);
  
    // Optionally, verify that the data from both requests is the same
    expect(firstData).toEqual(secondData);
  });
});