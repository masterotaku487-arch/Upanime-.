export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { url } = req.query

  if (!url) {
    return res.status(400).json({
      error: 'url obrigatoria'
    })
  }

  let parsed

  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({
      error: 'url invalida'
    })
  }

  const headers = {
    'Referer': 'https://animefire.io/',
    'Origin': 'https://animefire.io',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }

  // suporta range
  if (req.headers.range) {
    headers.Range = req.headers.range
  }

  try {

    const response = await fetch(url, {
      headers,
      redirect: 'follow'
    })

    res.status(response.status)

    // copia headers importantes
    const contentType =
      response.headers.get('content-type')

    const contentLength =
      response.headers.get('content-length')

    const contentRange =
      response.headers.get('content-range')

    if (contentType)
      res.setHeader('Content-Type', contentType)

    if (contentLength)
      res.setHeader('Content-Length', contentLength)

    if (contentRange)
      res.setHeader('Content-Range', contentRange)

    res.setHeader('Accept-Ranges', 'bytes')

    // stream
    const reader = response.body.getReader()

    while (true) {

      const { done, value } =
        await reader.read()

      if (done) break

      res.write(Buffer.from(value))
    }

    res.end()

  } catch (e) {

    return res.status(502).json({
      error: e.toString()
    })

  }
}
