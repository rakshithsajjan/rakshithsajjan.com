import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === 'www.rakshithsajjan.com') {
      return Response.redirect(`https://rakshithsajjan.com${url.pathname}${url.search}`, 301);
    }

    const options = {
      ASSETS: env.__STATIC_CONTENT,
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
    } catch (error) {
      return new Response('Not found', { status: 404 });
    }
  }
};
