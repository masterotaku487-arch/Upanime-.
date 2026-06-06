import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiRefreshCw, FiWifi, FiWifiOff } from 'react-icons/fi'
import './ApiStatusPage.css'

// ─── Endpoints monitorados ──────────────────────────────────────────────────
const ENDPOINTS = [
  // ── Catálogo ──────────────────────────────────────────────────────────────
  {
    id: 'catalog',
    label: 'Catálogo de Animes',
    sublabel: 'Jikan / MyAnimeList',
    icon: '📚',
    group: 'Dados',
    url: 'https://jikan-cache.masterotaku487.workers.dev/top/anime?limit=1',
    method: 'GET',
  },
  {
    id: 'database',
    label: 'Base de Dados',
    sublabel: 'AniList GraphQL',
    icon: '🔗',
    group: 'Dados',
    url: 'https://graphql.anilist.co',
    method: 'POST',
    body: JSON.stringify({ query: '{ Page(page:1,perPage:1){ media{ id } } }' }),
    headers: { 'Content-Type': 'application/json' },
  },

  // ── Servidores de vídeo ───────────────────────────────────────────────────
  {
    id: 'srv1',
    label: 'Servidor 1',
    sublabel: 'AnimesDrive · Principal',
    icon: '🚀',
    group: 'Vídeo',
    url: 'https://drivea.masterotaku487.workers.dev/?url=https://animesdrive.online/episodio/naruto-episodio-01',
    method: 'GET',
    badge: 'PRINCIPAL',
  },
  {
    id: 'srv2',
    label: 'Servidor 2',
    sublabel: 'AnimeQ · Dooplay',
    icon: '⚡',
    group: 'Vídeo',
    url: 'https://aq.masterotaku487.workers.dev/?url=https://animeq.net/episodio/naruto-episodio-01',
    method: 'GET',
  },
  {
    id: 'srv3',
    label: 'Servidor 3',
    sublabel: 'AniTube · HLS',
    icon: '📺',
    group: 'Vídeo',
    url: 'https://at.masterotaku487.workers.dev/',
    method: 'GET',
  },
  {
    id: 'srv4',
    label: 'Servidor 4',
    sublabel: 'AnimeFire · Fallback',
    icon: '🔥',
    group: 'Vídeo',
    url: 'https://animefire-proxy.masterotaku487.workers.dev/?action=search&title=naruto',
    method: 'GET',
  },
  {
    id: 'srv5',
    label: 'Servidor 5',
    sublabel: 'AnimeFontes · Render',
    icon: '☁️',
    group: 'Vídeo',
    url: 'https://animesfontes-proxy.onrender.com/ping',
    method: 'GET',
  },
]

const GROUPS = ['Dados', 'Vídeo']

const MAX_HISTORY  = 20
const STATUS_LABEL = { ok: 'Online', slow: 'Instável', error: 'Fora do ar' }
const STATUS_COLOR = { ok: '#22c55e', slow: '#f59e0b', error: '#ef4444' }
const STATUS_BG    = { ok: '#052e16', slow: '#2d1a00', error: '#2d0a0a' }

function getStatus(ms, error) {
  if (error)     return 'error'
  if (ms > 4000) return 'slow'
  return 'ok'
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function Sparkline({ points }) {
  const W = 120, H = 36, PAD = 4
  if (!points.length) return <svg width={W} height={H} />

  const values  = points.map(p => (p.status === 'error' ? null : p.ms))
  const nonNull = values.filter(Boolean)
  const max     = Math.max(...nonNull, 1000)

  const xs = points.map((_, i) => PAD + (i / (MAX_HISTORY - 1)) * (W - PAD * 2))
  const ys = points.map(p =>
    p.status === 'error'
      ? H - PAD
      : PAD + (1 - p.ms / max) * (H - PAD * 2)
  )

  const path = points.reduce((acc, p, i) => {
    if (p.status === 'error') return acc
    return acc + (i === 0 ? `M${xs[i]},${ys[i]}` : ` L${xs[i]},${ys[i]}`)
  }, '')

  const color = STATUS_COLOR[points[points.length - 1]?.status || 'ok']

  return (
    <svg width={W} height={H} className="sparkline">
      <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2}
        stroke="rgba(255,255,255,.05)" strokeWidth="1" />
      {path && (
        <path d={path} fill="none" stroke={color}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]}
          r={i === points.length - 1 ? 4 : 2.5}
          fill={STATUS_COLOR[p.status]}
          opacity={i === points.length - 1 ? 1 : 0.55} />
      ))}
    </svg>
  )
}

// ── Ping ──────────────────────────────────────────────────────────────────────
async function pingEndpoint(ep) {
  const t0 = Date.now()
  try {
    const res = await fetch(ep.url, {
      method:  ep.method || 'GET',
      body:    ep.body,
      headers: ep.headers,
      signal:  AbortSignal.timeout(9000),
    })
    const ms = Date.now() - t0
    // Workers retornam 400 para parâmetros inválidos mas ainda estão online
    const ok = res.status < 500
    return { ms: ok ? ms : 9999, status: getStatus(ok ? ms : 9999, !ok) }
  } catch {
    return { ms: 9999, status: 'error' }
  }
}

// ── Card ──────────────────────────────────────────────────────────────────────
function StatusCard({ ep, hist = [], loading }) {
  const last   = hist[hist.length - 1]
  const st     = last?.status || 'ok'
  const ms     = last?.ms
  const uptime = hist.length
    ? Math.round((hist.filter(h => h.status !== 'error').length / hist.length) * 100)
    : 100

  return (
    <div className={`status-card status-card-${st}`}
      style={{ borderColor: last ? STATUS_COLOR[st] + '33' : undefined }}>

      <div className="sc-top">
        <div className="sc-left">
          <span className="sc-icon">{ep.icon}</span>
          <div>
            <div className="sc-label-row">
              <h3 className="sc-label">{ep.label}</h3>
              {ep.badge && <span className="sc-badge">{ep.badge}</span>}
            </div>
            <p className="sc-sublabel">{ep.sublabel}</p>
            <div className="sc-status-row">
              <span className="sc-dot" style={{ background: STATUS_COLOR[st] }} />
              <span className="sc-status-text" style={{ color: STATUS_COLOR[st] }}>
                {loading ? 'Verificando...' : STATUS_LABEL[st]}
              </span>
              {!loading && ms && st !== 'error' && (
                <span className="sc-ms">{ms}ms</span>
              )}
            </div>
          </div>
        </div>

        <div className="sc-uptime">
          <span className="sc-uptime-num"
            style={{ color: uptime > 90 ? '#22c55e' : uptime > 70 ? '#f59e0b' : '#ef4444' }}>
            {uptime}%
          </span>
          <span className="sc-uptime-label">uptime</span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="sc-graph">
        {loading
          ? <div className="sc-loading">Verificando conexão...</div>
          : <Sparkline points={hist} />
        }
        <div className="sc-graph-labels">
          <span>—{MAX_HISTORY / 2}min atrás</span>
          <span>agora</span>
        </div>
      </div>

      {/* Barrinhas de histórico */}
      <div className="sc-bars">
        {Array(MAX_HISTORY).fill(0).map((_, i) => {
          const point = hist[i - (MAX_HISTORY - hist.length)]
          return (
            <div
              key={i}
              className="sc-bar"
              style={{
                background: point ? STATUS_COLOR[point.status] : 'rgba(255,255,255,.07)',
                height: point && point.status !== 'error'
                  ? `${Math.min(100, Math.max(20, 100 - (point.ms / 5000) * 80))}%`
                  : point ? '18%' : '30%',
              }}
              title={point ? `${point.ms}ms — ${STATUS_LABEL[point.status]}` : 'Sem dados'}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ApiStatusPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(() =>
    Object.fromEntries(ENDPOINTS.map(e => [e.id, { history: [], checking: true }]))
  )
  const [lastCheck, setLastCheck] = useState(null)
  const [checking,  setChecking]  = useState(false)
  const intervalRef = useRef(null)

  const check = async () => {
    setChecking(true)
    const results = await Promise.all(ENDPOINTS.map(ep => pingEndpoint(ep)))
    setData(prev => {
      const next = { ...prev }
      ENDPOINTS.forEach((ep, i) => {
        const hist = [...(prev[ep.id]?.history || [])]
        hist.push({ ...results[i], ts: Date.now() })
        if (hist.length > MAX_HISTORY) hist.shift()
        next[ep.id] = { history: hist, checking: false }
      })
      return next
    })
    setLastCheck(new Date())
    setChecking(false)
  }

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const allStatuses = ENDPOINTS.map(ep => data[ep.id]?.history?.slice(-1)[0]?.status)
  const hasError    = allStatuses.some(s => s === 'error')
  const hasSlow     = allStatuses.some(s => s === 'slow')
  const overallOk   = !hasError && !hasSlow

  // Contadores para o resumo
  const videoEndpoints = ENDPOINTS.filter(e => e.group === 'Vídeo')
  const videoOnline    = videoEndpoints.filter(e => {
    const s = data[e.id]?.history?.slice(-1)[0]?.status
    return s === 'ok' || s === 'slow'
  }).length

  return (
    <div className="status-page container">

      {/* Header */}
      <div className="status-header">
        <button className="back-btn" onClick={() => navigate('/config')}>
          <FiArrowLeft /> Voltar
        </button>
        <div>
          <h1 className="status-title">Status dos Serviços</h1>
          {lastCheck && (
            <p className="status-sub">
              Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
              <span className="status-sub-note"> · atualiza a cada 30s</span>
            </p>
          )}
        </div>
        <button className="refresh-btn" onClick={check} disabled={checking}>
          <FiRefreshCw className={checking ? 'spin' : ''} />
        </button>
      </div>

      {/* Banner geral */}
      <div className={`status-banner ${overallOk ? 'ok' : hasSlow ? 'slow' : 'issues'}`}>
        {overallOk
          ? <><FiWifi size={18} /> Todos os serviços estão operacionais</>
          : hasSlow && !hasError
          ? <><FiWifi size={18} /> Alguns serviços estão lentos</>
          : <><FiWifiOff size={18} /> Algum serviço pode estar com problemas</>
        }
      </div>

      {/* Resumo de servidores de vídeo */}
      <div className="srv-summary">
        <span className="srv-summary-label">🎬 Servidores de vídeo:</span>
        <span className="srv-summary-count"
          style={{ color: videoOnline >= 3 ? '#22c55e' : videoOnline >= 1 ? '#f59e0b' : '#ef4444' }}>
          {videoOnline}/{videoEndpoints.length} online
        </span>
        <div className="srv-summary-dots">
          {videoEndpoints.map(e => {
            const s = data[e.id]?.history?.slice(-1)[0]?.status || 'ok'
            return (
              <span key={e.id} className="srv-dot-wrap" title={`${e.label}: ${STATUS_LABEL[s]}`}>
                <span className="srv-dot-mini" style={{ background: STATUS_COLOR[s] }} />
                <span className="srv-dot-label">{e.label.replace('Servidor ', 'S')}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Cards por grupo */}
      {GROUPS.map(group => (
        <div key={group} className="status-group">
          <h2 className="status-group-title">
            {group === 'Vídeo' ? '🎬' : '🗄️'} {group}
          </h2>
          <div className="status-cards">
            {ENDPOINTS.filter(e => e.group === group).map(ep => (
              <StatusCard
                key={ep.id}
                ep={ep}
                hist={data[ep.id]?.history || []}
                loading={data[ep.id]?.checking && !data[ep.id]?.history?.length}
              />
            ))}
          </div>
        </div>
      ))}

      <p className="status-note">
        ⚠️ Verificações são feitas a cada 30 segundos do seu dispositivo.
        Resultados podem variar por localização.
      </p>
    </div>
  )
}
