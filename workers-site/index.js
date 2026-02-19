import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

/**
 * The manifest is a mapping of filenames to their hashed counterparts.
 * In some environments, it's passed as a JSON string, in others as an object.
 */
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

    const options = {
      ASSET_NAMESPACE: env.__STATIC_CONTENT,
      ASSET_MANIFEST: manifest
    };

    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise)
        },
        options
      );
    } catch (error) {
      // Fallback to 404.html if the asset is not found
      try {
        const notFoundRequest = new Request(`${url.origin}/404.html`, request);
        const response = await getAssetFromKV(
          {
            request: notFoundRequest,
            waitUntil: (promise) => ctx.waitUntil(promise)
          },
          options
        );
        return new Response(response.body, { ...response, status: 404 });
      } catch (e) {
        return new Response('Not found', { status: 404 });
      }
    }
  }
};
