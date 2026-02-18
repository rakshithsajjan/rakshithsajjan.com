import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import * as manifestModule from '__STATIC_CONTENT_MANIFEST';

const manifestJSON = manifestModule.default || manifestModule;

/**
 * The manual redirect list.
 */
const REDIRECTS = {
  'www.rakshithsajjan.com': 'rakshithsajjan.com',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    if (REDIRECTS[hostname]) {
      const location = `https://${REDIRECTS[hostname]}${url.pathname}${url.search}`;
      return Response.redirect(location, 301);
    }

    const options = {
      ASSET_NAMESPACE: env.__STATIC_CONTENT,
      ASSET_MANIFEST: typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON,
    };

    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
        options
      );
    } catch (e) {
      // Fallback to 404.html if it exists
      try {
        const notFoundResponse = await getAssetFromKV(
          {
            request: new Request(`${url.origin}/404.html`, request),
            waitUntil: (promise) => ctx.waitUntil(promise),
          },
          options
        );
        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 });
      } catch (e) {}

      return new Response('Not Found', { status: 404 });
    }
  },
};
