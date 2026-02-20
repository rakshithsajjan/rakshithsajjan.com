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
      const manifest = typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON;
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
        {
          ASSETS: env.__STATIC_CONTENT,
          manifest,
        }
      );
    } catch (error) {
      return new Response('Not found', { status: 404 });
    }
  }
};
