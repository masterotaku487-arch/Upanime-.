// functions/api/animefire.js
// Cloudflare Pages Function — AnimeFire scraping
// Roda na borda do Cloudflare — mesmo IP para scraping e stream → sem 401

const AF = 'https://animefire.io'

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':         `${AF}/`,
  'Origin':          AF,
  'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Cache-Control':   'no-cache',
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control':                'no-store',
  'Content-Type':                 'application/json',
}

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

async function fetchPage(path) {
  const res = await fetch(`${AF}${path}`, { headers: HEADERS, redirect: 'follow' })
  if (!res.ok) throw new Error(`AnimeFire ${res.status}: ${path}`)
  return res.text()
}

async function handleInfo(slug) {
  const html   = await fetchPage(`/animes/${slug}`)
  const epSet  = new Set()
  const re     = new RegExp(`/animes/${slug}/(\\d+)`, 'g')
  let m
  while ((m = re.exec(html)) !== null) epSet.add(parseInt(m[1]))
  const titleMatch = html.match(/<h1[^>]*>([^<]+)</) || html.match(/<title>([^<|]+)/)
  const title      = titleMatch ? titleMatch[1].trim() : slug
  const episodes   = [...epSet].sort((a, b) => a - b).map(ep => ({ ep }))
  return { slug, title, episodes, domain: AF }
}

async function handleVideo(slug, ep) {
  // _t garante token fresco, sem cache do CDN
  const html = await fetchPage(`/animes/${slug}/${ep}?_t=${Date.now()}`)

  // Padrão 1: /video/{slug}/{ep} — API JSON com sources
  const apiUrl = `${AF}/video/${slug}/${ep}`
  try {
    const apiRes = await fetch(apiUrl, {
      headers: { ...HEADERS, Accept: 'application/json, */*' },
    })
    if (apiRes.ok) {
      const text = await apiRes.text()
      if (!text.trim().startsWith('<')) {
        const d   = JSON.parse(text)
        const raw = d.data || d.sources || []
        if (raw.length) {
          return {
            sources: raw
              .map(s => ({ url: s.src || s.file || s.url, label: s.label || 'HD' }))
              .filter(s => s.url),
            domain: AF,
          }
        }
      }
    }
  } catch {}

  // Padrão 2: endpoint /video/{id} via data-video-src
  const vidMatch = html.match(/data-video-src="\/video\/([^"]+)"/)
    || html.match(/[\"'"]\/video\/([a-zA-Z0-9_-]{6,})[\"'"]/);
  if (vidMatch) {
    const apiRes = await fetch(`${AF}/video/${vidMatch[1]}`, {
      headers: { ...HEADERS, Accept: 'application/json, */*' },
    })
    if (apiRes.ok) {
      const d   = await apiRes.json()
      const raw = d.data || d.sources || []
      if (raw.length) {
        return {
          sources: raw
            .map(s => ({ url: s.src || s.file || s.url, label: s.label || 'HD' }))
            .filter(s => s.url),
          domain: AF,
        }
      }
    }
  }

  // Padrão 3: MP4 direto no HTML
  const mp4s = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g)]
  if (mp4s.length) {
    const unique = [...new Set(mp4s.map(m => m[0]))]
    return {
      sources: unique.map((url, i) => ({ url, label: i === 0 ? 'HD' : 'SD' })),
      domain: AF,
    }
  }

  // Padrão 4: JWPlayer sources array
  const srcArr = html.match(/sources\s*:\s*\[([^\]]+)\]/s)
  if (srcArr) {
    const files  = [...srcArr[1].matchAll(/file\s*:\s*["']([^"']+)["']/g)]
    const labels = [...srcArr[1].matchAll(/label\s*:\s*["']([^"']+)["']/g)]
    if (files.length) {
      return {
        sources: files.map((f, i) => ({ url: f[1], label: labels[i]?.[1] || 'HD' })),
        domain: AF,
      }
    }
  }

  throw new Error(`Sem fontes: ${slug} EP${ep}`)
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const url    = new URL(request.url)
  const action = url.searchParams.get('action')
  const slug   = url.searchParams.get('slug')
  const ep     = url.searchParams.get('ep')

  if (!action) return jsonRes({ ok: true, domain: AF })
  if (!slug)   return jsonRes({ error: 'slug obrigatório' }, 400)

  try {
    if (action === 'info')  return jsonRes(await handleInfo(slug.trim()))
    if (action === 'video') return jsonRes(await handleVideo(slug.trim(), parseInt(ep || '1')))
    return jsonRes({ error: `Action inválida: ${action}` }, 400)
  } catch (e) {
    console.error(`[animefire] ${action} ${slug} EP${ep}:`, e.message)
    return jsonRes({ error: e.message }, 500)
  }
}
