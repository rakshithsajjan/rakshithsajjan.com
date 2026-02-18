import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const ASSET_MANIFEST = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    const redirect = baseRedirects.find(r => r.from === hostname);
    if (redirect) {
      return Response.redirect(`https://${redirect.to}${url.pathname}${url.search}`, 301);
    }

    const options = {
      ASSET_NAMESPACE: env.__STATIC_CONTENT,
      ASSET_MANIFEST,
    };

    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        options
      );
    } catch (e) {
      try {
        const notFoundResponse = await getAssetFromKV(
          {
            request: new Request(`${url.origin}/404.html`, request),
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          options
        );
        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 });
      } catch (e) {}

      return new Response('Not Found', { status: 404 });
    }
  },
};
