import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rule = baseRedirects.find((r) => r.from === url.hostname.toLowerCase());
    if (rule) {
      const location = `https://${rule.to}${url.pathname}${url.search}`;
      return Response.redirect(location, 301);
    }

    try {
      const options = {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: typeof manifestJSON === 'string' ? JSON.parse(manifestJSON) : manifestJSON,
      };
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
