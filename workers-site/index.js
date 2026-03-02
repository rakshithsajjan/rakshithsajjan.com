import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

/**
 * Handle asset manifest parsing.
 * In some wrangler versions, __STATIC_CONTENT_MANIFEST is a JSON string,
 * in others it's a pre-parsed object.
 */
const assetManifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const redirect = baseRedirects.find((rule) => rule.from === url.hostname.toLowerCase());
    if (redirect) {
      const location = `https://${redirect.to}${url.pathname}${url.search}`;
      return Response.redirect(location, 301);
    }

    try {
      /**
       * getAssetFromKV requires the request and waitUntil in the first object,
       * and the KV namespace + manifest in the options object.
       */
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise)
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest
        }
      );
    } catch (e) {
      if (e.status === 404 || e.message?.includes('not found')) {
        return new Response('Not found', { status: 404 });
      }
      return new Response('Internal error', { status: 500 });
    }
  }
};
