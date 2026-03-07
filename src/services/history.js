// src/services/history.js — Histórico de episódios assistidos

const KEY = 'upanime_watch_history'
const MAX = 30 // máximo de entradas no histórico

/** Salva ou atualiza entrada no histórico */
export const saveHistory = (anime, ep) => {
  if (!anime?.mal_id) return
  try {
    const history = getHistory()
    const idx = history.findIndex(h => h.mal_id === anime.mal_id)
    const entry = {
      mal_id:     anime.mal_id,
      title:      anime.title_english || anime.title || 'Anime',
      image:      anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
      episodes:   anime.episodes || 0,
      lastEp:     ep,
      watchedAt:  Date.now(),
    }
    if (idx >= 0) history.splice(idx, 1) // remove duplicata
    history.unshift(entry)               // mais recente primeiro
    if (history.length > MAX) history.length = MAX
    localStorage.setItem(KEY, JSON.stringify(history))
  } catch { /* sem acesso ao localStorage */ }
}

/** Retorna histórico completo */
export const getHistory = () => {
  try {
    const d = localStorage.getItem(KEY)
    return d ? JSON.parse(d) : []
  } catch { return [] }
}

/** Remove um item do histórico */
export const removeHistory = (malId) => {
  try {
    const h = getHistory().filter(e => e.mal_id !== malId)
    localStorage.setItem(KEY, JSON.stringify(h))
  } catch {}
}

/** Limpa todo o histórico */
export const clearHistory = () => {
  try { localStorage.removeItem(KEY) } catch {}
}

/** Retorna progresso salvo de um ep específico */
export const getEpProgress = (malId, ep) => {
  try {
    const d = localStorage.getItem(`progress_${malId}_${ep}`)
    if (!d) return null
    const { current, duration } = JSON.parse(d)
    return duration > 0 ? Math.round((current / duration) * 100) : 0
  } catch { return null }
}
