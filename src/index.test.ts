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
});
