import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiPlay, FiAward, FiBell, FiVolume2 } from 'react-icons/fi'
import { getNotificationLog, getLastSeen, markNotificationsSeen } from '../services/notifications'
import { loadAchievements, ACHIEVEMENTS } from '../services/achievements'
import { getBroadcasts } from '../services/supabase'
import './NotificationsPage.css'

const DAY_MS = 24 * 60 * 60 * 1000

function timeAgo(ts) {
  const diff = Date.now() - ts
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return 'agora mesmo'
  if (min < 60)  return `Há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `Há ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1)   return 'Ontem'
  if (d < 7)     return `${d} dias atrás`
  return new Date(ts).toLocaleDateString('pt-BR')
}

// Junta episódios novos (dos favoritos) + conquistas desbloqueadas +
// avisos do admin, num único feed, do mais recente pro mais antigo.
async function buildFeed() {
  const episodeEntries = getNotificationLog().map(n => ({
    id: n.id,
    type: 'episode',
    time: n.time,
    title: <>Novo episódio de <b>{n.title}</b> — Ep. {n.ep} disponível.</>,
    url: n.url,
  }))

  const achData = loadAchievements()
  const achEntries = Object.entries(achData.seenAt || {}).map(([id, time]) => {
    const a = ACHIEVEMENTS.find(x => x.id === id)
    if (!a) return null
    return {
      id: `ach_${id}`,
      type: 'achievement',
      time,
      title: <>Conquista desbloqueada: <b>{a.title}</b> {a.icon}</>,
      url: '/conquistas',
    }
  }).filter(Boolean)

  let broadcastEntries = []
  try {
    const broadcasts = await getBroadcasts(20)
    broadcastEntries = (broadcasts || []).map(b => ({
      id: `bc_${b.id}`,
      type: 'broadcast',
      time: new Date(b.created_at).getTime(),
      title: <><b>{b.title}</b> — {b.message}</>,
      url: '/notificacoes',
    }))
  } catch { /* offline ou tabela ainda não criada — segue sem avisos */ }

  return [...episodeEntries, ...achEntries, ...broadcastEntries].sort((a, b) => b.time - a.time)
}

export default function NotificationsPage() {
  const [feed, setFeed] = useState([])
  const [lastSeen] = useState(getLastSeen())

  useEffect(() => {
    buildFeed().then(setFeed)
    // Marca como lido só depois que a tela já renderizou o estado "não lido"
    const t = setTimeout(() => markNotificationsSeen(), 1200)
    return () => clearTimeout(t)
  }, [])

  const unreadCount = feed.filter(n => n.time > lastSeen).length
  const now = Date.now()
  const hoje    = feed.filter(n => now - n.time < DAY_MS)
  const semana  = feed.filter(n => now - n.time >= DAY_MS && now - n.time < 7 * DAY_MS)
  const antigas = feed.filter(n => now - n.time >= 7 * DAY_MS)

  const Row = ({ n }) => (
    <Link to={n.url} className={`notif-row ${n.time > lastSeen ? 'unread' : ''}`}>
      <div className="notif-ic">
        {n.type === 'episode' ? <FiPlay /> : n.type === 'broadcast' ? <FiVolume2 /> : <FiAward />}
      </div>
      <div className="notif-body">
        <div className="notif-title">{n.title}</div>
        <div className="notif-time">{timeAgo(n.time)}</div>
      </div>
      {n.time > lastSeen && <div className="notif-dot" />}
    </Link>
  )

  return (
    <div className="notifications-page">
      <div className="list-top">
        <div className="list-title">Notificações</div>
        <div className="list-sub">
          {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
        </div>
      </div>

      {feed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FiBell /></div>
          <div className="empty-title">Nenhuma notificação ainda</div>
          <p className="empty-text">
            Favorite animes pra saber quando sair episódio novo, e desbloqueie
            conquistas assistindo — tudo aparece aqui.
          </p>
        </div>
      ) : (
        <>
          {hoje.length > 0 && (
            <>
              <div className="notif-section-title">Hoje</div>
              {hoje.map(n => <Row key={n.id} n={n} />)}
            </>
          )}
          {semana.length > 0 && (
            <>
              <div className="notif-section-title">Esta Semana</div>
              {semana.map(n => <Row key={n.id} n={n} />)}
            </>
          )}
          {antigas.length > 0 && (
            <>
              <div className="notif-section-title">Mais Antigas</div>
              {antigas.map(n => <Row key={n.id} n={n} />)}
            </>
          )}
        </>
      )}
    </div>
  )
}
