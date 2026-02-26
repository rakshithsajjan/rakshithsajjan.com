import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

// Handle both string and object manifests
const manifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    // Check for redirects
    const redirect = baseRedirects.find((rule) => hostname === rule.from);
    if (redirect) {
      return Response.redirect(`https://${redirect.to}${url.pathname}${url.search}`, 301);
    }

    const options = {
      ASSET_NAMESPACE: env.__STATIC_CONTENT,
      ASSET_MANIFEST: manifest,
    };

    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
        options
      );
    } catch (error) {
      // Fallback to 404.html
      try {
        const notFoundRequest = new Request(`${url.origin}/404.html`, request);
        const notFoundResponse = await getAssetFromKV(
          {
            request: notFoundRequest,
            waitUntil: (promise) => ctx.waitUntil(promise),
          },
          options
        );
        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 });
      } catch (e) {}

      return new Response('Not found', { status: 404 });
    }
  }
};
