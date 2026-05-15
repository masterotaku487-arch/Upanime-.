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

    const range =
      request.headers.get("range") || "bytes=0-"

    const response = await fetch(
      decodeURIComponent(target),
      {

        method: "GET",

        headers: {

          "user-agent":
            request.headers.get("user-agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36",

          "referer":
            "https://animefire.io/",

          "origin":
            "https://animefire.io",

          "accept":
            "*/*",

          "range":
            range,

          "accept-language":
            "pt-BR,pt;q=0.9,en;q=0.8",

          "sec-fetch-dest":
            "video",

          "sec-fetch-mode":
            "cors",

          "sec-fetch-site":
            "cross-site",

          "cf-connecting-ip":
            request.headers.get("cf-connecting-ip") || "",

          "x-forwarded-for":
            request.headers.get("x-forwarded-for") || "",
        },

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

    const headers = new Headers(response.headers)

    Object.entries(cors).forEach(([k, v]) => {
      headers.set(k, v)
    })

    headers.set("Accept-Ranges", "bytes")

    headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    )

    headers.delete("content-security-policy")
    headers.delete("x-frame-options")

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
