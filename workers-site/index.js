import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const manifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const redirect = baseRedirects.find((rule) => rule.from === url.hostname.toLowerCase());

    if (redirect) {
      const location = `https://${redirect.to}${url.pathname}${url.search}`;
      return Response.redirect(location, 301);
    }

    try {
      // getAssetFromKV expects an FetchEvent-like object in the first argument
      // when using Module Worker, we construct a minimal shim.
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: manifest,
        }
      );
    } catch (error) {
      try {
        let notFoundResponse = await getAssetFromKV(
          {
            request,
            waitUntil: (promise) => ctx.waitUntil(promise),
          },
          {
            mapRequestToAsset: (req) => new Request(`${new URL(req.url).origin}/404.html`, req),
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: manifest,
          }
        );
        return new Response(notFoundResponse.body, {
          ...notFoundResponse,
          status: 404,
        });
      } catch (e) {
        return new Response('Not found', { status: 404 });
      }
    }
  },
};
