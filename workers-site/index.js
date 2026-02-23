import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const manifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === 'www.rakshithsajjan.com') {
      const location = `https://rakshithsajjan.com${url.pathname}${url.search}`;
      return Response.redirect(location, 301);
    }

    const event = {
      request,
      waitUntil: (promise) => ctx.waitUntil(promise),
    };

    try {
      return await getAssetFromKV(event, {
        ASSETS: env.__STATIC_CONTENT,
        manifest,
      });
    } catch (error) {
      return new Response('Not found', { status: 404 });
    }
  },
};
