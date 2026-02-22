import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    const redirect = baseRedirects.find((rule) => rule.from === hostname);
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
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  },
};
