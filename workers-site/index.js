import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

const baseRedirects = [
  { from: 'www.rakshithsajjan.com', to: 'rakshithsajjan.com' }
];
const oneHour = 60 * 60;
const oneDay = oneHour * 24;
const oneYear = oneDay * 365;

addEventListener('fetch', (event) => {
  event.respondWith(handle(event));
});

function acceptsBrotli(request) {
  return /\bbr\b/.test(request.headers.get('accept-encoding') || '');
}

function appendVary(headers, value) {
  const current = headers.get('Vary');
  if (!current) return value;
  const parts = current.split(',').map((part) => part.trim().toLowerCase());
  return parts.includes(value.toLowerCase()) ? current : `${current}, ${value}`;
}

function cacheControl(request) {
  const { pathname } = new URL(request.url);

  if (pathname === '/' || pathname.endsWith('.html')) {
    return {
      browserTTL: 0,
      edgeTTL: oneHour
    };
  }

  if (pathname.startsWith('/_astro/') || pathname.startsWith('/media/ascii-bike/')) {
    return {
      browserTTL: oneYear,
      edgeTTL: oneYear
    };
  }

  return {
    browserTTL: oneDay,
    edgeTTL: oneDay
  };
}

function assetEvent(event, request = event.request) {
  return {
    request,
    waitUntil: event.waitUntil.bind(event)
  };
}

async function getAsset(event, request = event.request) {
  return getAssetFromKV(assetEvent(event, request), { cacheControl });
}

async function getAsciiFrames(event) {
  if (!acceptsBrotli(event.request)) {
    const response = await getAsset(event);
    const headers = new Headers(response.headers);
    headers.set('Vary', appendVary(headers, 'Accept-Encoding'));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const brUrl = new URL(event.request.url);
  brUrl.pathname = '/media/ascii-bike/frames.bin.br';
  const brRequest = new Request(brUrl.toString(), event.request);

  try {
    const response = await getAsset(event, brRequest);
    const headers = new Headers(response.headers);
    headers.set('Content-Encoding', 'br');
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Vary', appendVary(headers, 'Accept-Encoding'));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    const response = await getAsset(event);
    const headers = new Headers(response.headers);
    headers.set('Vary', appendVary(headers, 'Accept-Encoding'));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}

async function handle(event) {
  const url = new URL(event.request.url);
  const redirect = baseRedirects.find((rule) => rule.from === url.hostname.toLowerCase());
  if (redirect) {
    const location = `https://${redirect.to}${url.pathname}${url.search}`;
    return Response.redirect(location, 301);
  }

  try {
    if (url.pathname === '/media/ascii-bike/frames.bin') {
      return await getAsciiFrames(event);
    }

    return await getAsset(event);
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}
