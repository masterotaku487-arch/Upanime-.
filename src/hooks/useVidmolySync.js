/**
 * useVidmolySync.js
 * Hook que roda uma vez ao carregar o app e enfileira no Vidmoly
 * todas as directUrl do slug-overrides.json que ainda são links MP4 diretos.
 * 
 * Coloca em: src/hooks/useVidmolySync.js
 */

import { useEffect } from 'react'

const WORKER = 'https://vid.masterotaku487.workers.dev'
const DONE_KEY = 'vidmoly_sent' // localStorage: set de URLs já enviadas

function getSent() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')) }
  catch { return new Set() }
}

function markSent(url) {
  const sent = getSent()
  sent.add(url)
  localStorage.setItem(DONE_KEY, JSON.stringify([...sent]))
}

function buildTitle(titulo, ep, tipo) {
  const epStr = String(ep).padStart(2, '0')
  return `${titulo} – Ep ${epStr} ${tipo.toUpperCase()}`
}

export function useVidmolySync() {
  useEffect(() => {
    async function sync() {
      let overrides
      try {
        const res = await fetch('/slug-overrides.json')
        const data = await res.json()
        overrides = data.animes ?? {}
      } catch {
        return // sem overrides, nada a fazer
      }

      const sent = getSent()
      const queue = [] // { url, title }

      for (const [malId, entry] of Object.entries(overrides)) {
        const directUrl = entry.drivea?.directUrl
        if (!directUrl) continue

        const titulo = entry._titulo ?? `MAL-${malId}`

        for (const tipo of ['leg', 'dub']) {
          const eps = directUrl[tipo]
          if (!eps) continue

          for (const [ep, url] of Object.entries(eps)) {
            // Só URLs MP4 diretas (ignora file_codes já processados)
            if (!url.startsWith('http')) continue
            // Ignora URLs que já foram enviadas antes
            if (sent.has(url)) continue

            queue.push({ url, title: buildTitle(titulo, ep, tipo) })
          }
        }
      }

      if (queue.length === 0) return

      console.log(`[VidmolySync] ${queue.length} vídeo(s) para enfileirar`)

      for (const { url, title } of queue) {
        try {
          const workerUrl = `${WORKER}/?action=send&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
          const res  = await fetch(workerUrl)
          const data = await res.json()

          if (data.ok) {
            console.log(`[VidmolySync] ✅ Enfileirado: ${title}`)
            markSent(url) // marca como enviado para não reenviar
          } else {
            console.warn(`[VidmolySync] ⚠️ Falhou: ${title}`, data)
          }
        } catch (e) {
          console.warn(`[VidmolySync] ❌ Erro: ${title}`, e.message)
        }

        // Pequena pausa entre requests
        await new Promise(r => setTimeout(r, 300))
      }
    }

    sync()
  }, [])
}
