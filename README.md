# smol scraper

This project is a Cloudflare worker designed to scrape web pages and extract useful information, including a markdown-formatted version of the content. It's built to handle requests to scrape a given URL and return structured data about the page. 

## Features

- from https://github.com/ozanmakes/scrapedown
  - Fetch and scrape content from any given URL.
  - Extract metadata such as title, byline, excerpt, and more.
  - Convert HTML content to clean markdown format.
  - Handle requests with optional markdown formatting.
  - Remove everything but the content (Reader Mode)
- extra added
  - better handling for twitter, youtube
  - custom hanlding for HN

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
  "html": "...",
  "textContent": "Unsloth currently only supports Linux distros and Pytorch \\>\\= 2.1.\n\n    conda install cudatoolkit xformers bitsandbytes pytorch pytorch-cuda=12.1 \\\n      -c pytorch -c nvidia -c xformers -c conda-forge -y\n    pip install \"unsloth[kaggle] @ git+https://github.com/unslothai/unsloth.git\"\n    \n\n    import torch; torch.version.cuda\n    \n\n    pip install \"unsloth[cu118] @ git+https://github.com/unslothai/unsloth.git\"\n    pip install \"unsloth[cu121] @ git+https://github.com/unslothai/unsloth.git\"\n    ",
  "meta": {
    "og:image": "https://opengraph.githubassets.com/8f60a81589b42847aa98eecb4f6613bfc9fb68646f57ced9ea9377ab2151e2cb/unslothai/unsloth",
    "og:title": "GitHub - unslothai/unsloth: 80% faster 50% less memory LLM finetuning",
    "og:description": "80% faster 50% less memory LLM finetuning. Contribute to unslothai/unsloth development by creating an account on GitHub."
  }
}
```

http://localhost:8787/?url=https://news.ycombinator.com/item?id=38487199

```json
{
  "textContent": "![](s.gif)\n\n[](vote?id=38493724&how=up&goto=item%3Fid%3D38487199)\n\n  \n\nIt'd be great to have a chronicle of all these efforts. I lost track of the variations quite a long time ago.\n\nIt'd be quite a lift unless we're just willing to just accept the self reported metrics as golden. And even then, they're always qualified by hardware and usage scope. Making it good enough to be useful is the hard part. CI/CD pipeline with a bunch of machine configurations and benchmarks along with a reasonable way ",
  "meta": {
    "title": "Show HN: 80% faster, 50% less memory, 0% loss of accuracy Llama finetuning | Hacker News",
    "HackerNews": "{\"score\":\"157\",\"hnuser\":\"danielhanchen\",\"articleUrl\":\"https://github.com/unslothai/unsloth\"}"
  }
}
```


## Dev

```sh
npm i
npm start
```

## Deployment

Use Wrangler CLI:

```sh
npm run deploy
```

This is currently deployed to scraper.shawnthe14483.workers.dev which is proxied to https://scraper.smol.ai/

so use it as: https://scraper.smol.ai/?url=https://github.com/unslothai/unsloth/issues/4