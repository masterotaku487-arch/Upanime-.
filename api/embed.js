// /api/embed.js — Vercel Serverless
// Busca a página, remove scripts de anúncio e serve HTML limpo para iframe
//
// Uso: /api/embed?url=https://animes.strp2p.com/%23ak6nz

const AD_SCRIPT_PATTERNS = [
  // Redes de anúncio comuns
  'googlesyndication', 'doubleclick', 'googletagmanager', 'googletagservices',
  'adnxs', 'amazon-adsystem', 'moatads', 'outbrain', 'taboola',
  'popads', 'popcash', 'adcash', 'trafficjunky', 'juicyads',
  'hilltopads', 'propellerads', 'monetag', 'adsterra', 'exoclick',
  'traffic-stars', 'ero-advertising', 'etahub', 'plugrush',
  'adspyglass', 'bidvertiser', 'revcontent', 'mgid',
  // Scripts de popup/redirect genéricos
  'pop.js', 'popunder', 'popcnt', 'pops.js',
]

const AD_ELEMENT_SELECTORS = [
  // IDs e classes típicos de anúncio
  '#ad', '.ad', '.ads', '.advertisement', '.banner',
  '[id*="advert"]', '[class*="advert"]',
  '[id*="banner"]', '[class*="banner"]',
  'ins.adsbygoogle',
]

function stripAds(html, baseUrl) {
  // Remove <script> tags de redes de anúncio
  html = html.replace(/<script[^>]*src=["'][^"']*(?:googlesyndication|doubleclick|googletagmanager|adnxs|amazon-adsystem|popads|popcash|adcash|trafficjunky|juicyads|hilltopads|propellerads|monetag|adsterra|exoclick|traffic-stars|ero-advertising|etahub|plugrush|adspyglass|bidvertiser|revcontent|mgid|pop\.js|popunder|popcnt|pops\.js)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '')
  html = html.replace(/<script[^>]*src=["'][^"']*(?:googlesyndication|doubleclick|googletagmanager|adnxs|amazon-adsystem|popads|popcash|adcash|trafficjunky|juicyads|hilltopads|propellerads|monetag|adsterra|exoclick|traffic-stars|ero-advertising|etahub|plugrush|adspyglass|bidvertiser|revcontent|mgid|pop\.js|popunder|popcnt|pops\.js)[^"']*["'][^>]*\/>/gi, '')

  // Remove <ins class="adsbygoogle">
  html = html.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '')

  // Remove pop/redirect inline scripts (padrão comum em sites de anime)
  html = html.replace(/<script[^>]*>[\s\S]*?(?:window\.open|popunder|pop_|_pop|openPopup|adBlocker|adblock)[\s\S]*?<\/script>/gi, '')

  // Remove <iframe> de ad networks
  html = html.replace(/<iframe[^>]*(?:doubleclick|googlesyndication|adnxs)[^>]*>[\s\S]*?<\/iframe>/gi, '')

  // Injeta CSS para esconder elementos de ad por seletor
  const adCss = `
<style>
  /* Ad blocker injetado pelo UpAnime+ proxy */
  #ad, .ad, .ads, .advertisement, .banner-ad, .ad-banner,
  [id*="advert"], [class*="advert"], [id*="banner"], [class*="adban"],
  ins.adsbygoogle, .popup, .pop-up, .overlay-ad,
  iframe[src*="doubleclick"], iframe[src*="googlesyndication"] {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
  }
  body { margin: 0; background: #000; }
</style>`

  // Injeta antes do </head> ou no início do <body>
  if (html.includes('</head>')) {
    html = html.replace('</head>', adCss + '</head>')
  } else {
    html = adCss + html
  }

  // Corrige URLs relativas para absolutas (necessário dentro do iframe)
  const origin = new URL(baseUrl).origin
  html = html.replace(/href="\/(?!\/)/g, `href="${origin}/`)
  html = html.replace(/src="\/(?!\/)/g, `src="${origin}/`)
  html = html.replace(/action="\/(?!\/)/g, `action="${origin}/`)

  return html
}

export default async function handler(req, res) {
  const { url } = req.query

  if (!url) {
    return res.status(400).send('Parâmetro url obrigatório')
  }

  let targetUrl
  try {
    targetUrl = decodeURIComponent(url)
    new URL(targetUrl) // valida URL
  } catch {
    return res.status(400).send('URL inválida')
  }

  // Permite apenas domínios de streaming conhecidos (segurança)
  const allowedDomains = [
    'animes.strp2p.com',
    'animefire.io',
    'animesonlinecc.to',
    'animesonline.cloud',
    'animeshd.com',
    'goyabu.io',
    'goyabu.com',
    'lightspeedst.net',
  ]
  const hostname = new URL(targetUrl).hostname
  if (!allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d))) {
    return res.status(403).send('Domínio não permitido: ' + hostname)
  }

  try {
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin + '/',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    })

    if (!pageRes.ok) {
      return res.status(pageRes.status).send(`Erro ao buscar página: ${pageRes.status}`)
    }

    const contentType = pageRes.headers.get('content-type') || ''
    let html = await pageRes.text()

    // Se não for HTML, redireciona direto
    if (!contentType.includes('text/html')) {
      return res.redirect(targetUrl)
    }

    html = stripAds(html, targetUrl)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    // X-Frame-Options não enviado → permite ser embutido
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.status(200).send(html)

  } catch (e) {
    console.error('[embed proxy]', e.message)
    res.status(500).send('Erro interno: ' + e.message)
  }
}
