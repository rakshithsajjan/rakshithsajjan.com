import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];

addEventListener('fetch', (event) => {
  event.respondWith(handle(event));
});

async function handle(event) {
  const url = new URL(event.request.url);
  const hostname = url.hostname.toLowerCase();
  const redirect = baseRedirects.find((rule) => hostname === rule.from);

  if (redirect) {
    return Response.redirect(`https://${redirect.to}${url.pathname}${url.search}`, 301);
  }

  try {
    return await getAssetFromKV(event);
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}
