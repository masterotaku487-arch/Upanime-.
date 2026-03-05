// Vercel Serverless — Fontes alternativas BR de anime
// Suporta: animeshd, animesonlinecc, animesonlinecloud
// Uso: /api/altsources?title=Naruto&ep=1&source=animeshd

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Referer': 'https://www.google.com/',
}

const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')

// Extrai iframe/src de vídeo do HTML
function extractVideoSrc(html) {
  const patterns = [
    /(?:src|data-src)=["']([^"']*(?:mp4|m3u8)[^"']*?)["']/gi,
    /file:\s*["']([^"']+(?:mp4|m3u8)[^"']*?)["']/gi,
    /source\s+src=["']([^"']+)["'][^>]*type=["']video/gi,
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (m?.[1] && !m[1].includes('data:')) return m[1]
  }
  // Tenta extrair iframe do player
  const iframeMatch = html.match(/(?:iframe[^>]+src|player[^>]+src)=["']([^"']+)["']/i)
  return iframeMatch?.[1] || null
}

// animeshd.to
async function tryAnimesHD(title, ep) {
  const slug = slugify(title)
  const candidates = [
    `${slug}-episodio-${ep}-sem-censura`,
    `${slug}-episodio-${ep}`,
    `${slug}-ep-${ep}`,
  ]
  for (const c of candidates) {
    try {
      const url = `https://animeshd.to/episodios/${c}/`
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const html = await res.text()
      const src = extractVideoSrc(html)
      if (src) return { source: 'animeshd', url, videoSrc: src }
      // Retorna a página mesmo sem src direto (player embed)
      if (html.includes('video') || html.includes('player')) {
        return { source: 'animeshd', pageUrl: url, embed: true }
      }
    } catch { }
  }
  return null
}

// animesonlinecc.to
async function tryAnimesOnlineCC(title, ep) {
  const slug = slugify(title)
  const candidates = [
    `${slug}-episodio-${ep}`,
    `${slug}-ep-${ep}`,
    `${slug}-${ep}`,
  ]
  for (const c of candidates) {
    try {
      const url = `https://animesonlinecc.to/episodio/${c}/`
      const res = await fetch(url, { headers: { ...HEADERS, Referer: 'https://animesonlinecc.to/' }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const html = await res.text()
      const src = extractVideoSrc(html)
      if (src || html.includes('player')) {
        return { source: 'animesonlinecc', pageUrl: url, videoSrc: src || null, embed: !src }
      }
    } catch { }
  }
  return null
}

// animesonline.cloud
async function tryAnimesOnlineCloud(title, ep, dub = false) {
  const slug = slugify(title)
  const epStr = String(ep).padStart(2, '0')
  const dubSuffix = dub ? '-dublado' : ''
  const candidates = [
    `${slug}${dubSuffix}-episodio-${epStr}`,
    `${slug}${dubSuffix}-episodio-${ep}`,
    `${slug}-episodio-${epStr}`,
  ]
  for (const c of candidates) {
    try {
      const url = `https://animesonline.cloud/episodio/${c}`
      const res = await fetch(url, { headers: { ...HEADERS, Referer: 'https://animesonline.cloud/' }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const html = await res.text()
      const src = extractVideoSrc(html)
      if (src || html.includes('player')) {
        return { source: 'animesonlinecloud', pageUrl: url, videoSrc: src || null, embed: !src }
      }
    } catch { }
  }
  return null
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { title, ep = 1, dub = '0', source } = req.query
  if (!title) return res.status(400).json({ error: 'Parâmetro "title" obrigatório' })

  const isDub = dub === '1'
  const results = []

  // Tenta as fontes em paralelo (mais rápido)
  const promises = []

  if (!source || source === 'animeshd')
    promises.push(tryAnimesHD(title, ep).then(r => r && results.push(r)))

  if (!source || source === 'animesonlinecc')
    promises.push(tryAnimesOnlineCC(title, ep).then(r => r && results.push(r)))

  if (!source || source === 'animesonlinecloud')
    promises.push(tryAnimesOnlineCloud(title, ep, isDub).then(r => r && results.push(r)))

  await Promise.allSettled(promises)

  if (!results.length) {
    return res.status(404).json({ error: `"${title}" EP${ep} não encontrado nas fontes alternativas` })
  }

  return res.status(200).json({ results, total: results.length })
}
