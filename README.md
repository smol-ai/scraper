<img align="right" width="300"  src="https://github.com/osener/scrapedown/assets/111265/cc059686-c452-4982-82c9-023c7696699b">

# scrapedown

This project is a Cloudflare worker designed to scrape web pages and extract useful information, including a markdown-formatted version of the content. It's built to handle requests to scrape a given URL and return structured data about the page. 

## Features

- Fetch and scrape content from any given URL.
- Extract metadata such as title, byline, excerpt, and more.
- Convert HTML content to clean markdown format.
- Handle requests with optional markdown formatting.
- Remove everything but the content (Reader Mode)

## Usage

To use this worker, send a GET request to the worker's endpoint with the `url` query parameter specifying the page to be scraped. Optionally, you can include the `html` query parameter to specify whether you also want the raw HTML format (default: `false`).
e

### Example Request

```
GET https://<worker-name>.workers.dev/?url=https://example.com&html=true
```

### Example Response

```json
{
  "page": {
    "byline": "Author Name",
    "content": "... stripped html content ...",
    "dir": null,
    "excerpt": "..."
    "lang": null,
    "length": 191,
    "siteName": null,
    "textContent": "... markdown content ...",
    "title": "Example Domain"
  }
}
```

## Deployment

Use Wrangler CLI:

```sh
npx wrangler deploy
```


## Attribution

forked from https://github.com/ozanmakes/scrapedown