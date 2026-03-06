import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

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
      const assetManifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
        {
          ASSETS: env.__STATIC_CONTENT,
          mapRequestToAsset: (req) => {
            const url = new URL(req.url);
            if (url.pathname.endsWith('/')) {
              url.pathname += 'index.html';
            }
            return new Request(url.toString(), req);
          },
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      try {
        const assetManifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;
        const notFoundResponse = await getAssetFromKV(
          {
            request: new Request(`${url.origin}/404.html`),
            waitUntil: (promise) => ctx.waitUntil(promise),
          },
          {
            ASSETS: env.__STATIC_CONTENT,
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );

        return new Response(notFoundResponse.body, {
          ...notFoundResponse,
          status: 404,
        });
      } catch (e2) {
        return new Response('Not found', { status: 404 });
      }
    }
  },
};
