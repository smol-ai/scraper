# smol scraper

This project is a Cloudflare worker designed to scrape web pages and extract useful information, including a markdown-formatted version of the content. It's built to handle requests to scrape a given URL and return structured data about the page. 

Note: this API is not stable, and we reserve the right to change anything with no prior warning for now. If we turn this into a real service someday, we'll have an SLA for changes.

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

When a parse fails, eg because of rate limits, we will return an error with a corresponding statuscode. You can pass `silenceErr=true` to silence this.

### Example `/?url` Request

```
GET https://<worker-name>.workers.dev/?url=https://example.com&html=true
```

Response

```json
{
  "html": "...",
  "textContent": "Unsloth currently only supports Linux distros and Pytorch \\>\\= 2.1.\n\n    conda install cudatoolkit xformers bitsandbytes pytorch pytorch-cuda=12.1 \\\n      -c pytorch -c nvidia -c xformers -c conda-forge -y\n    pip install \"unsloth[kaggle] @ git+https://github.com/unslothai/unsloth.git\"\n    \n\n    import torch; torch.version.cuda\n    \n\n    pip install \"unsloth[cu118] @ git+https://github.com/unslothai/unsloth.git\"\n    pip install \"unsloth[cu121] @ git+https://github.com/unslothai/unsloth.git\"\n    ",
  "meta": {
    "image": "https://opengraph.githubassets.com/8f60a81589b42847aa98eecb4f6613bfc9fb68646f57ced9ea9377ab2151e2cb/unslothai/unsloth",
    "title": "GitHub - unslothai/unsloth: 80% faster 50% less memory LLM finetuning",
    "description": "80% faster 50% less memory LLM finetuning. Contribute to unslothai/unsloth development by creating an account on GitHub."
  }
}
```

#### maxChars

All textContents are truncated to `maxChars` of 1000 by default. You can specify a custom maxChar, or effectively turn it off by sending in a negative number.

try: https://scraper.smol.ai/?url=https://en.wikipedia.org/wiki/Elon_Musk&maxChars=-1

#### special handlers and metadata (HN, Twitter, YouTube)

We attempt to return special info whenever it is a recognized URL, e.g.

- Hacker News: http://localhost:8787/?url=https://news.ycombinator.com/item?id=38487199
    ```json
    {
      "textContent": "![](s.gif)\n\n[](vote?id=38493724&how=up&goto=item%3Fid%3D38487199)\n\n  \n\nIt'd be great to have a chronicle of all these efforts. I lost track of the variations quite a long time ago.\n\nIt'd be quite a lift unless we're just willing to just accept the self reported metrics as golden. And even then, they're always qualified by hardware and usage scope. Making it good enough to be useful is the hard part. CI/CD pipeline with a bunch of machine configurations and benchmarks along with a reasonable way ",
      "meta": {
        "title": "Show HN: 80% faster, 50% less memory, 0% loss of accuracy Llama finetuning | Hacker News",
        "detectedType": "Hacker News",
        "specialMeta": "{\"score\":\"157\",\"hnuser\":\"danielhanchen\",\"articleUrl\":\"https://github.com/unslothai/unsloth\"}"
      }
    }
    ```
- YouTube http://localhost:8787/?url=https://youtu.be/F5gxtgrRhqc?si=50KvdOy8pBLSBL6X
    ```json
    {
    "textContent": "{\"title\":\"Endless Runner Games with FlutterFlow: Players &amp; Obstacles Movement\",\"image\":\"https://i.ytimg.com/vi/F5gxtgrRhqc/maxresdefault.jpg\",\"description\":\"Let&#39;s create a fun endless runner game, like Chrome Dino but with a cool Mario theme, all in FlutterFlow and without any custom code yet. You&#39;re watching a m...\",\"detectedType\":\"YouTube\"}",
    "metaObject": {
      "title": "Endless Runner Games with FlutterFlow: Players &amp; Obstacles Movement",
      "image": "https://i.ytimg.com/vi/F5gxtgrRhqc/maxresdefault.jpg",
      "description": "Let&#39;s create a fun endless runner game, like Chrome Dino but with a cool Mario theme, all in FlutterFlow and without any custom code yet. You&#39;re watching a m...",
      "detectedType": "YouTube"
    }
    }
    ```
- Twitter http://localhost:8787/?url=https://twitter.com/labenz/status/1630284912853917697
    ```json
    {
      "textContent": "{\"image\":\"https://pbs.twimg.com/media/Fp_p8uWX0AMk-nW.jpg\",\"title\":\"Nathan Labenz (@labenz)\",\"description\":\"OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\\n\\nAnother AI-obsessive megathread on what to expect in 2023 🧵\",\"detectedType\":\"Twitter\"}",
      "metaObject": {
        "image": "https://pbs.twimg.com/media/Fp_p8uWX0AMk-nW.jpg",
        "title": "Nathan Labenz (@labenz)",
        "description": "OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\n\nAnother AI-obsessive megathread on what to expect in 2023 🧵",
        "detectedType": "Twitter"
      }
    }
    ```
    
We currently **skip Discord links** (in /enhance only) bc there is no way to get data from them without being logged in.

### Example `/enhance?str` Request

This just runs a regex on a given string for any urls, and then runs the url replacement, and returns a string, with a default recommended insertion strategy that should be good out of the box.

```
GET http://localhost:8787/enhance?str=i%20really%20enjoyed%20https://www.youtube.com/watch?v=yi8Cq2SZy48%20and%20https://twitter.com/labenz/status/1630284912853917697%20today.
```

RESPONSE

```json
{
  "str": "i really enjoyed https://www.youtube.com/watch?v=yi8Cq2SZy48 <<<YouTube video titled: \"An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI\" (Description: From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...)>>> and https://twitter.com/labenz/status/1630284912853917697 <<<@labenz: OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\n\nAnother AI-obsessive megathread on what to expect in 2023 🧵>>> today.",
  "links": {
    "https://www.youtube.com/watch?v=yi8Cq2SZy48": {
      "textContent": "YouTube video titled: \"An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI\" (Description: From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...)",
      "metaObject": {
        "title": "An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI",
        "image": "https://i.ytimg.com/vi/yi8Cq2SZy48/maxresdefault.jpg",
        "description": "From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...",
        "detectedType": "YouTube"
      }
    },
    "https://twitter.com/labenz/status/1630284912853917697": {
      "textContent": "@labenz: OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\n\nAnother AI-obsessive megathread on what to expect in 2023 🧵",
      "metaObject": {
        "image": "https://pbs.twimg.com/media/Fp_p8uWX0AMk-nW.jpg",
        "title": "Tweet from Nathan Labenz (@labenz)",
        "description": "OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\n\nAnother AI-obsessive megathread on what to expect in 2023 🧵",
        "detectedType": "Twitter",
        "specialMeta": {
          "username": "labenz"
        }
      }
    }
  }
}
```


Errors happen and are naturally suppressed (aka "[errors are no-ops](https://github.com/smol-ai/scraper/issues/1)"). To expose errors for a given url, pass `exposeErrors=true`.

If you want more control, use the `returnJSON` param and then you can regex to your heart's content to do your own string replacement or postprocessing:

```
GET http://localhost:8787/enhance?returnJSON=true&str=i%20really%20enjoyed%20https://www.youtube.com/watch?v=yi8Cq2SZy48%20and%20https://twitter.com/labenz/status/1630284912853917697%20today.
```

RESPONSE

```json
{
"https://www.youtube.com/watch?v=yi8Cq2SZy48": {
"textContent": "{\"title\":\"An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI\",\"image\":\"https://i.ytimg.com/vi/yi8Cq2SZy48/maxresdefault.jpg\",\"description\":\"From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...\",\"detectedType\":\"YouTube\"}",
"metaObject": {
"title": "An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI",
"image": "https://i.ytimg.com/vi/yi8Cq2SZy48/maxresdefault.jpg",
"description": "From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...",
"detectedType": "YouTube"
}
},
"https://twitter.com/labenz/status/1630284912853917697": {
"textContent": "{\"image\":\"https://pbs.twimg.com/media/Fp_p8uWX0AMk-nW.jpg\",\"title\":\"Nathan Labenz (@labenz)\",\"description\":\"OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\\n\\nAnother AI-obsessive megathread on what to expect in 2023 🧵\",\"detectedType\":\"Twitter\"}",
"metaObject": {
"image": "https://pbs.twimg.com/media/Fp_p8uWX0AMk-nW.jpg",
"title": "Nathan Labenz (@labenz)",
"description": "OpenAI&#39;s leaked Foundry pricing says a lot – if you know how to read it – about GPT4, The Great Implementation, a move from Generative to Productive AI, OpenAI&#39;s safety & growth strategies, and the future of work.\n\nAnother AI-obsessive megathread on what to expect in 2023 🧵",
"detectedType": "Twitter"
}
}
}
```

### `maxUrls`

sometimes messages get really crazy and drop a whole lot of links at once. this is actually no problem for the scraper - it expands urls serially and safely - however this can cause the resulting string to blow up in length and potentially casue a context length issue for downstream consumers. Simple math - if default maxChars is 1000, and someone drops a message with 20 links in there, then one message blows up to say `20 * (1000 + epsilon header other stuff we add - say another 100 chars)` - so about 21k chars. not a problem for modern context lengths in isolation but when this is done to summarize a chat people may get a nasty surprise.

so our default `maxUrls` limit is 3. after 3 it just stops trying to expand links and just returns.

```
GET http://localhost:8787/enhance?maxUrls=1&str=i%20really%20enjoyed%20https://www.youtube.com/watch?v=yi8Cq2SZy48%20and%20https://twitter.com/labenz/status/1630284912853917697%20today.

RESPONSE

{
  "str":"i really enjoyed https://www.youtube.com/watch?v=yi8Cq2SZy48 <<<YouTube video titled: \"An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI\" (Description: From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...)>>> and https://twitter.com/labenz/status/1630284912853917697 today.",
  "links":{
    "https://www.youtube.com/watch?v=yi8Cq2SZy48":{
      "textContent":"YouTube video titled: \"An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI\" (Description: From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...)",
      "metaObject":{"title":"An Actually Big Week in AI: AutoGen, The A-Phone, Mistral 7B, GPT-Fathom and Meta Hunts CharacterAI",
      "image":"https://i.ytimg.com/vi/yi8Cq2SZy48/maxresdefault.jpg",
      "description":"From dramatic new use cases for GPT Vision, Meta bringing language models to billions of people, Autogen as the new AutoGPT, to what I’m calling the Altman P...","detectedType":"YouTube"
      }
    }
  }
}  
```


## Dev

```sh
npm i
```
After installing all of the packages, you need to generate a `KV_NAMESPACE` connected to your cloudflare account.

to do so run
```sh
npx wrangler kv:namespace create REQUEST_CACHE --preview

# OUTPUT:
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "REQUEST_CACHE", preview_id = "d0a0b1d935cd48edb0313bf3cbe39723" }
```
This is actually missing a piece you'll need. Copy/paste the `preview_id` and have it as the `id` as well.

So in your local wrangerl.toml file you should have
```toml
kv_namespaces = [
  { binding = "REQUEST_CACHE", preview_id = "d0a0b1d935cd48edb0313bf3cbe39723", id = "d0a0b1d935cd48edb0313bf3cbe39723"},
]
```
Now when you run `npm start` or `npx wrangler dev` you should see it spin up and print out
> Your worker has access to the following bindings:
> - KV Namespaces:
>   - REQUEST_CACHE: ff883219643646e79581d812e6b6a904
>
>
>⎔ Starting local server...
---


## Deployment

```sh
npm test # runs our basic test suite
```


Use Wrangler CLI:

```sh
npm run deploy # runs wrangler deploy --env production. because we use KV https://github.com/smol-ai/scraper/pull/6
```

This is currently deployed to scraper.shawnthe14483.workers.dev which is proxied to https://scraper.smol.ai/

so use it as: https://scraper.smol.ai/?url=https://github.com/unslothai/unsloth/issues/4