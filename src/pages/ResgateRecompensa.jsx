import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './ResgateRecompensa.css'

const API = 'https://rewards-proxy.masterotaku487.workers.dev'

const ICONS = {
  cargo:      '🏅',
  cor:        '🎨',
  vip:        '💎',
  conquista:  '🏆',
  xp:         '⭐',
  titulo:     '✨',
  custom:     '🎁',
}

export default function ResgateRecompensa() {
  const nav  = useNavigate()
  const { user, openLogin } = useAuth()
  const [code,    setCode]    = useState('')
  const [status,  setStatus]  = useState(null)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)

  const resgatar = async () => {
    if (!user) { openLogin(); return }
    const c = code.trim().toUpperCase()
    if (!c) return
    setLoading(true); setStatus(null); setResult(null)
    try {
      const r = await fetch(`${API}/resgatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c, userId: user.id || user.uid, userName: user.name || user.displayName })
      })
      const d = await r.json()
      if (d.ok) {
        setStatus('ok')
        setResult(d)
        // Salva perfil localmente
        localStorage.setItem('upanime_rewards_profile', JSON.stringify(d.profile))
      } else {
        setStatus('erro')
        setResult({ error: d.error })
      }
    } catch(e) {
      setStatus('erro'); setResult({ error: 'Erro de conexão. Tente novamente.' })
    }
    setLoading(false)
  }

  return (
    <div className="resgate-page">
      <div className="resgate-header">
        <button className="resgate-back" onClick={() => nav(-1)}>‹</button>
        <h1 className="resgate-title">🎁 Resgatar Recompensa</h1>
      </div>

      <div className="resgate-card">
        <div className="resgate-icon">🎟️</div>
        <p className="resgate-sub">
          Digite o código de recompensa para resgatar cargos, VIP, cores especiais e muito mais!
        </p>

        {!user ? (
          <div className="resgate-login">
            <p>Você precisa estar logado para resgatar recompensas.</p>
            <button className="resgate-btn" onClick={openLogin}>🔒 Entrar com Google</button>
          </div>
        ) : status === 'ok' ? (
          <div className="resgate-success">
            <div className="resgate-success-icon">🎉</div>
            <h2>Recompensa resgatada!</h2>
            <p className="resgate-desc">{result?.descricao}</p>
            <div className="resgate-rewards-list">
              {result?.recompensas?.map((r, i) => (
                <div key={i} className="resgate-reward-item">{r}</div>
              ))}
            </div>
            <p className="resgate-nota">Suas recompensas ficam salvas no servidor — nunca perdem mesmo trocando de celular! ✅</p>
            <button className="resgate-btn" onClick={() => { setCode(''); setStatus(null); setResult(null) }}>
              Resgatar outro código
            </button>
            <button className="resgate-btn-ghost" onClick={() => nav('/perfil')}>Ver meu perfil</button>
          </div>
        ) : (
          <>
            <div className="resgate-input-wrap">
              <input
                className="resgate-input"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setStatus(null) }}
                placeholder="UP-XXXXXXXX"
                maxLength={20}
                onKeyDown={e => e.key === 'Enter' && resgatar()}
              />
            </div>
            {status === 'erro' && (
              <div className="resgate-erro">❌ {result?.error}</div>
            )}
            <button className="resgate-btn" onClick={resgatar} disabled={loading || !code.trim()}>
              {loading ? '⏳ Resgatando...' : '🎁 Resgatar'}
            </button>
          </>
        )}
      </div>

      {/* Preview dos tipos de recompensa */}
      <div className="resgate-tipos">
        <div className="resgate-tipos-title">O que você pode ganhar:</div>
        <div className="resgate-tipos-grid">
          {Object.entries(ICONS).map(([tipo, icon]) => (
            <div key={tipo} className="resgate-tipo-item">
              <span>{icon}</span>
              <span>{tipo === 'cargo' ? 'Cargo exclusivo'
                   : tipo === 'cor'   ? 'Cor do nome'
                   : tipo === 'vip'   ? 'VIP (eterno ou prazo)'
                   : tipo === 'conquista' ? 'Conquista rara'
                   : tipo === 'xp'    ? 'XP extra'
                   : tipo === 'titulo'? 'Título no perfil'
                   : 'Recompensa especial'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
