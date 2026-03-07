import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiRefreshCw, FiWifi, FiWifiOff, FiAlertCircle } from 'react-icons/fi'
import './ApiStatusPage.css'

// ─── Endpoints monitorados (sem nomes reais, só labels genéricos) ───────────
const ENDPOINTS = [
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: '📚',
    url: 'https://api.jikan.moe/v4/top/anime?limit=1',
    method: 'GET',
  },
  {
    id: 'video1',
    label: 'Servidor de Vídeo',
    icon: '🎬',
    url: 'https://animefire-proxy.masterotaku487.workers.dev/?action=search&title=naruto',
    method: 'GET',
  },
  {
    id: 'video2',
    label: 'Fonte Alternativa 2',
    icon: '☁️',
    url: 'https://animesonlinecloud-proxy.masterotaku487.workers.dev/?action=search&title=naruto',
    method: 'GET',
  },
  {
    id: 'database',
    label: 'Base de Dados',
    icon: '🔗',
    url: 'https://graphql.anilist.co',
    method: 'POST',
    body: JSON.stringify({ query: '{ Page(page:1,perPage:1){ media{ id } } }' }),
    headers: { 'Content-Type': 'application/json' },
  },
]

const MAX_HISTORY = 20 // pontos no gráfico

const STATUS_LABEL = { ok: 'Online', slow: 'Instável', error: 'Fora do ar' }
const STATUS_COLOR = { ok: '#22c55e', slow: '#f59e0b', error: '#ef4444' }

function getStatus(ms, error) {
  if (error)  return 'error'
  if (ms > 3000) return 'slow'
  return 'ok'
}

// Sparkline SVG mini-gráfico
function Sparkline({ points }) {
  const W = 120, H = 40, PAD = 4
  if (!points.length) return <svg width={W} height={H} />

  const values = points.map(p => (p.status === 'error' ? null : p.ms))
  const nonNull = values.filter(Boolean)
  const max = Math.max(...nonNull, 1000)
  const min = 0

  const xs = points.map((_, i) => PAD + (i / (MAX_HISTORY - 1)) * (W - PAD * 2))
  const ys = points.map(p =>
    p.status === 'error'
      ? H - PAD
      : PAD + (1 - (p.ms - min) / (max - min)) * (H - PAD * 2)
  )

  const path = points.reduce((acc, p, i) => {
    if (p.status === 'error') return acc
    return acc + (i === 0 ? `M${xs[i]},${ys[i]}` : ` L${xs[i]},${ys[i]}`)
  }, '')

  const lastStatus = points[points.length - 1]?.status || 'ok'
  const color = STATUS_COLOR[lastStatus]

  return (
    <svg width={W} height={H} className="sparkline">
      {/* Grid line */}
      <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} stroke="rgba(255,255,255,.05)" strokeWidth="1" />
      {/* Path */}
      {path && <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Pontos */}
      {points.map((p, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={i === points.length - 1 ? 4 : 2.5}
          fill={STATUS_COLOR[p.status]} opacity={i === points.length - 1 ? 1 : 0.6} />
      ))}
    </svg>
  )
}

async function pingEndpoint(ep) {
  const t0 = Date.now()
  try {
    const res = await fetch(ep.url, {
      method: ep.method || 'GET',
      body: ep.body,
      headers: ep.headers,
      signal: AbortSignal.timeout(8000),
    })
    const ms = Date.now() - t0
    const ok = res.ok || res.status < 500
    return { ms: ok ? ms : 9999, status: getStatus(ok ? ms : 9999, !ok) }
  } catch {
    return { ms: 9999, status: 'error' }
  }
}

export default function ApiStatusPage() {
  const navigate = useNavigate()
  const [data, setData]       = useState(() =>
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
    intervalRef.current = setInterval(check, 30_000) // re-verifica a cada 30s
    return () => clearInterval(intervalRef.current)
  }, [])

  const overallOk = ENDPOINTS.every(ep => {
    const last = data[ep.id]?.history?.slice(-1)[0]
    return !last || last.status !== 'error'
  })

  return (
    <div className="status-page container">
      <div className="status-header">
        <button className="back-btn" onClick={() => navigate('/config')}>
          <FiArrowLeft /> Voltar
        </button>
        <div>
          <h1 className="status-title">Status dos Serviços</h1>
          {lastCheck && (
            <p className="status-sub">
              Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
        <button className="refresh-btn" onClick={check} disabled={checking}>
          <FiRefreshCw className={checking ? 'spin' : ''} />
        </button>
      </div>

      {/* Banner geral */}
      <div className={`status-banner ${overallOk ? 'ok' : 'issues'}`}>
        {overallOk
          ? <><FiWifi size={20} /> Todos os serviços estão operacionais</>
          : <><FiWifiOff size={20} /> Algum serviço pode estar com problemas</>
        }
      </div>

      {/* Cards */}
      <div className="status-cards">
        {ENDPOINTS.map(ep => {
          const hist    = data[ep.id]?.history || []
          const loading = data[ep.id]?.checking && !hist.length
          const last    = hist[hist.length - 1]
          const st      = last?.status || 'ok'
          const ms      = last?.ms || 0
          const uptime  = hist.length
            ? Math.round((hist.filter(h => h.status !== 'error').length / hist.length) * 100)
            : 100

          return (
            <div key={ep.id} className={`status-card status-card-${st}`}>
              <div className="sc-top">
                <div className="sc-left">
                  <span className="sc-icon">{ep.icon}</span>
                  <div>
                    <h3 className="sc-label">{ep.label}</h3>
                    <div className="sc-status-row">
                      <span className="sc-dot" style={{ background: STATUS_COLOR[st] }} />
                      <span className="sc-status-text" style={{ color: STATUS_COLOR[st] }}>
                        {loading ? 'Verificando...' : STATUS_LABEL[st]}
                      </span>
                      {!loading && last && st !== 'error' && (
                        <span className="sc-ms">{ms}ms</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="sc-uptime">
                  <span className="sc-uptime-num">{uptime}%</span>
                  <span className="sc-uptime-label">uptime</span>
                </div>
              </div>

              <div className="sc-graph">
                {loading
                  ? <div className="sc-loading">Verificando conexão...</div>
                  : <Sparkline points={hist} />
                }
                <div className="sc-graph-labels">
                  <span>— {MAX_HISTORY * 0.5}min atrás</span>
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
                        background: point
                          ? STATUS_COLOR[point.status]
                          : 'rgba(255,255,255,.08)',
                        height: point && point.status !== 'error'
                          ? `${Math.min(100, Math.max(20, 100 - (point.ms / 5000) * 80))}%`
                          : point ? '20%' : '30%',
                      }}
                      title={point ? `${point.ms}ms — ${STATUS_LABEL[point.status]}` : 'Sem dados'}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="status-note">
        ⚠️ Verificações são feitas a cada 30 segundos. Resultados podem variar por localização.
      </p>
    </div>
  )
      }
                        
