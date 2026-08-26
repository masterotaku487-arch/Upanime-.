// src/services/downloads.js
// Histórico local de episódios baixados, pra alimentar a tela de
// Downloads nas Configurações. O arquivo em si vai pra pasta de
// Downloads do aparelho (isso é controlado pelo navegador/sistema,
// não dá pra escolher a pasta via JS) — aqui só guardamos o registro
// de "o que já foi baixado" pra mostrar no app.

const KEY = 'upanime_downloads'
const MAX = 100

export const getDownloads = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

const saveDownloads = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))) } catch {}
}

/** Registra um episódio como baixado (mais recente primeiro) */
export const addDownload = (entry) => {
  const list = getDownloads()
  const id = `${entry.animeId}_${entry.ep}`
  const filtered = list.filter(d => d.id !== id) // evita duplicar o mesmo episódio
  filtered.unshift({ id, time: Date.now(), ...entry })
  saveDownloads(filtered)
}

export const removeDownload = (id) => {
  saveDownloads(getDownloads().filter(d => d.id !== id))
}

export const clearDownloads = () => saveDownloads([])
