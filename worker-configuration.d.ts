import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  REQUEST_CACHE: KVNamespace;
}
