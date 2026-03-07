// src/services/notifications.js
// Verifica novos episódios dos favoritos e dispara notificação do browser

const KEY_EP_COUNT = 'upanime_ep_counts'

/** Solicita permissão de notificação ao usuário */
export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

/** Retorna se notificações estão ativas */
export const notifEnabled = () =>
  localStorage.getItem('upanime_notif') === '1' &&
  Notification.permission === 'granted'

/** Salva contagem de episódios conhecida */
const saveEpCount = (counts) =>
  localStorage.setItem(KEY_EP_COUNT, JSON.stringify(counts))

const loadEpCounts = () => {
  try { return JSON.parse(localStorage.getItem(KEY_EP_COUNT) || '{}') } catch { return {} }
}

/** Dispara notificação do browser */
const notify = (title, body, icon, url) => {
  if (!notifEnabled()) return
  try {
    const n = new Notification(`🔔 ${title}`, { body, icon, silent: false })
    n.onclick = () => { window.focus(); if (url) window.location.href = url }
  } catch {}
}

/**
 * Verifica todos os favoritos e notifica se encontrar novo episódio.
 * Chame isso uma vez ao carregar o app (ex: no App.jsx).
 */
export const checkNewEpisodes = async (favorites) => {
  if (!notifEnabled() || !favorites?.length) return

  const stored = loadEpCounts()
  const updated = { ...stored }

  for (const fav of favorites) {
    try {
      await new Promise(r => setTimeout(r, 500)) // respeita rate-limit Jikan

      const res  = await fetch(`https://jikan-cache.masterotaku487.workers.dev/anime/${fav.mal_id}`)
      if (!res.ok) continue
      const data = await res.json()
      const current = data.data?.episodes_aired ?? data.data?.episodes ?? 0

      const prev = stored[fav.mal_id] ?? 0

      if (prev > 0 && current > prev) {
        notify(
          fav.title,
          `Novo episódio disponível! EP ${current} acabou de sair 🎉`,
          fav.image,
          `/watch/${fav.mal_id}?ep=${current}`
        )
      }

      updated[fav.mal_id] = current
    } catch { /* falha silenciosa */ }
  }

  saveEpCount(updated)
}
