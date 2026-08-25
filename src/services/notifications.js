// src/services/notifications.js
// Verifica novos episódios dos favoritos, dispara notificação do browser
// e mantém um histórico (log) pra alimentar a tela de Notificações do app.

const KEY_EP_COUNT  = 'upanime_ep_counts'
const KEY_LOG        = 'upanime_notif_log'
const KEY_LAST_SEEN  = 'upanime_notif_last_seen'
const MAX_LOG = 60

/** Solicita permissão de notificação ao usuário */
export const requestNotifPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

/** Retorna se as notificações push do navegador estão ativas */
export const notifEnabled = () =>
  localStorage.getItem('upanime_notif') === '1' &&
  typeof Notification !== 'undefined' &&
  Notification.permission === 'granted'

/** Salva contagem de episódios conhecida */
const saveEpCount = (counts) =>
  localStorage.setItem(KEY_EP_COUNT, JSON.stringify(counts))

const loadEpCounts = () => {
  try { return JSON.parse(localStorage.getItem(KEY_EP_COUNT) || '{}') } catch { return {} }
}

// ─── Histórico de notificações (pra tela in-app) ────────────────────────────

export const getNotificationLog = () => {
  try { return JSON.parse(localStorage.getItem(KEY_LOG) || '[]') } catch { return [] }
}

const saveNotificationLog = (log) => {
  try { localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, MAX_LOG))) } catch {}
}

/** Adiciona uma notificação ao histórico (mais recente primeiro) */
export const pushNotification = (entry) => {
  const log = getNotificationLog()
  const id = entry.id || `${entry.type}_${entry.malId || entry.achId || ''}_${Date.now()}`
  // evita duplicar a mesma notificação (ex: mesmo episódio detectado 2x)
  if (log.some(n => n.id === id)) return
  log.unshift({ time: Date.now(), ...entry, id })
  saveNotificationLog(log)
}

export const getLastSeen = () => Number(localStorage.getItem(KEY_LAST_SEEN) || 0)

/** Marca tudo como lido (chamar ao abrir a tela de notificações) */
export const markNotificationsSeen = () => {
  localStorage.setItem(KEY_LAST_SEEN, String(Date.now()))
}

/** Quantidade de notificações não vistas ainda (pro badge do sininho) */
export const getUnreadCount = () => {
  const last = getLastSeen()
  return getNotificationLog().filter(n => n.time > last).length
}

/** Dispara notificação push do navegador (se permitido) */
const notify = (title, body, icon, url) => {
  if (!notifEnabled()) return
  try {
    const n = new Notification(`🔔 ${title}`, { body, icon, silent: false })
    n.onclick = () => { window.focus(); if (url) window.location.href = url }
  } catch {}
}

/**
 * Verifica todos os favoritos e registra/notifica se encontrar novo episódio.
 * Roda sempre que houver favoritos (independente do push estar ligado),
 * pra alimentar o histórico da tela de Notificações. O push do navegador
 * (notify) só dispara se o usuário tiver ativado nas Configurações.
 */
export const checkNewEpisodes = async (favorites) => {
  if (!favorites?.length) return

  const stored  = loadEpCounts()
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
        pushNotification({
          type:  'episode',
          malId: fav.mal_id,
          title: fav.title,
          ep:    current,
          image: fav.image,
          url:   `/watch/${fav.mal_id}?ep=${current}`,
        })
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
