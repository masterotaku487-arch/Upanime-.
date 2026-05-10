export async function onRequest(context) {

  const request = context.request
  const url = new URL(request.url)

  const target = url.searchParams.get("url")

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Accept-Ranges",
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors,
    })
  }

  if (!target) {
    return new Response("Missing url", {
      status: 400,
      headers: cors,
    })
  }

  try {

    const response = await fetch(
      decodeURIComponent(target),
      {

        method: "GET",

        headers: {

          // Navegador real
          "user-agent":
            request.headers.get("user-agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36",

          // AnimeFire real
          "referer":
            "https://animefire.io/",

          "origin":
            "https://animefire.io",

          // Streaming
          "accept": "*/*",

          "range":
            request.headers.get("range") || "bytes=0-",

          // Simular browser
          "accept-language":
            "pt-BR,pt;q=0.9,en;q=0.8",

          "sec-fetch-dest":
            "video",

          "sec-fetch-mode":
            "cors",

          "sec-fetch-site":
            "cross-site",

          // Cloudflare passthrough
          "cf-connecting-ip":
            request.headers.get("cf-connecting-ip") || "",

          "x-forwarded-for":
            request.headers.get("x-forwarded-for") || "",

        },

        // Cloudflare config
        cf: {
          cacheEverything: false,
          cacheTtl: 0,
          scrapeShield: false,
          apps: false,
          mirage: false,
          polish: false,
        },
      }
    )

    // Copiar headers originais
    const headers = new Headers(response.headers)

    // CORS
    Object.entries(cors).forEach(([k, v]) => {
      headers.set(k, v)
    })

    // Streaming
    headers.set("Accept-Ranges", "bytes")

    // Evitar cache/token velho
    headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    )

    // Segurança
    headers.delete("content-security-policy")
    headers.delete("x-frame-options")

    // Stream direto
    return new Response(
      response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers,
      }
    )

  } catch (err) {

    return new Response(

      JSON.stringify({
        error: true,
        message: String(err),
        stack: err?.stack || null,
      }, null, 2),

      {
        status: 500,

        headers: {
          ...cors,
          "content-type": "application/json",
        },
      }
    )
  }
}
