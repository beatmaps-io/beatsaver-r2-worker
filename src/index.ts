import type { Env } from "@cloudflare/workers-types"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};

async function handleOptions(request: Request) {
  let headers = request.headers;
  if (
      headers.get('Origin') !== null &&
      headers.get('Access-Control-Request-Method') !== null &&
      headers.get('Access-Control-Request-Headers') !== null
  ) {
    let respHeaders = {
      ...corsHeaders,
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '',
    };

    return new Response(null, { headers: respHeaders });
  } else {
    return new Response(null, {
      headers: {
        Allow: 'GET, OPTIONS',
      },
    });
  }
}

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const key = url.pathname.slice(1);

  switch (request.method) {
    case "GET":
      if (url.pathname === "/") {
        return new Response("OK");
      }

      const cache = caches.default;
      let response = await cache.match(request);

      if (!response || !response.ok) {
        const object = await env.BUCKET.get(key);
        const name = await env.KVSTORE.get(key);

        if (!object) {
          return new Response("Object Not Found", {status: 404});
        }

        let responseHeaders = !name ? corsHeaders : {
          ...corsHeaders,
          'Content-Disposition': 'attachment; filename="' + name + '"',
          'etag': object.httpEtag,
          'cache-control': 'public, max-age=1800',
          'last-modified': object.uploaded.toUTCString()
        }

        response = new Response(object.body, {headers: responseHeaders});
        ctx.waitUntil(cache.put(request, response.clone()));
      }

      return response;
    case "OPTIONS":
      return handleOptions(request);
    default:
      return new Response("Route Not Found.", { status: 404 });
  }
}