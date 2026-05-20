import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPage.css'

const API          = 'https://studio-proxy.masterotaku487.workers.dev'
const ADMIN_KEY    = 'upanime_admin_auth'

export default function AdminPage() {
  const nav = useNavigate()
  const [authed, setAuthed]     = useState(!!localStorage.getItem(ADMIN_KEY))
  const [senha, setSenha]       = useState('')
  const [senhaErr, setSenhaErr] = useState('')
  const [dados, setDados]       = useState({ studios: [], fanDubs: [] })
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [secret, setSecret]     = useState(localStorage.getItem(ADMIN_KEY) || '')

  useEffect(() => { if (authed) carregar() }, [authed])

  const login = async () => {
    setSenhaErr('')
    const r = await fetch(`${API}/api/admin/pendentes`, {
      headers: { 'Authorization': `Bearer ${senha}` }
    })
    if (r.ok) {
      localStorage.setItem(ADMIN_KEY, senha)
      setSecret(senha)
      setAuthed(true)
    } else {
      setSenhaErr('Senha incorreta!')
    }
  }

  const carregar = async () => {
    setLoading(true)
    const r = await fetch(`${API}/api/admin/pendentes`, {
      headers: { 'Authorization': `Bearer ${secret}` }
    })
    const d = await r.json()
    setDados(d)
    setLoading(false)
  }

  const acao = async (tipo, id, acao, motivo = '') => {
    const endpoint = acao === 'aprovar' ? '/api/admin/aprovar' : '/api/admin/recusar'
    const r = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, motivo })
    })
    const d = await r.json()
    if (d.ok) {
      setMsg(`✅ ${acao === 'aprovar' ? 'Aprovado' : 'Recusado'} com sucesso!`)
      setTimeout(() => setMsg(''), 3000)
      carregar()
    }
  }

  if (!authed) return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-icon">🔐</div>
        <h1>Painel Admin</h1>
        <p>UpAnime+ • Área restrita</p>
        <input
          className="admin-input"
          type="password"
          placeholder="Senha admin"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
        />
        {senhaErr && <div className="admin-err">{senhaErr}</div>}
        <button className="admin-btn" onClick={login}>Entrar</button>
      </div>
    </div>
  )

  const totalPendentes = (dados.studios?.length || 0) + (dados.fanDubs?.length || 0)

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="admin-back" onClick={() => nav(-1)}>‹</button>
        <div>
          <h1 className="admin-title">🛡️ Painel Admin</h1>
          <p className="admin-sub">{totalPendentes} item(s) pendente(s)</p>
        </div>
        <div className="admin-header-right">
          <button className="admin-refresh" onClick={carregar}>🔄</button>
          <button className="admin-logout" onClick={() => { localStorage.removeItem(ADMIN_KEY); setAuthed(false) }}>Sair</button>
        </div>
      </div>

      {msg && <div className="admin-toast">{msg}</div>}

      {loading ? (
        <div className="admin-loading">Carregando...</div>
      ) : (
        <>
          {/* Estúdios pendentes */}
          <div className="admin-section">
            <div className="admin-section-title">
              🎙️ Estúdios Pendentes
              <span className="admin-count">{dados.studios?.length || 0}</span>
            </div>

            {!dados.studios?.length ? (
              <div className="admin-empty">Nenhum estúdio pendente</div>
            ) : dados.studios.map(s => (
              <div key={s.id} className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-icon">🎙️</div>
                  <div className="admin-card-info">
                    <div className="admin-card-nome">{s.nome}</div>
                    <div className="admin-card-email">{s.email}</div>
                    <div className="admin-card-date">
                      {new Date(s.criadoEm).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {s.descricao && (
                  <div className="admin-card-desc">{s.descricao}</div>
                )}

                {s.discord && (
                  <div className="admin-card-meta">
                    💬 <a href={s.discord} target="_blank" rel="noopener noreferrer">{s.discord}</a>
                  </div>
                )}

                {s.exemplos && (
                  <div className="admin-card-meta">📎 {s.exemplos}</div>
                )}

                <div className="admin-card-btns">
                  <button className="admin-approve" onClick={() => acao('studio', s.id, 'aprovar')}>
                    ✅ Aprovar
                  </button>
                  <button className="admin-reject" onClick={() => {
                    const motivo = prompt('Motivo da recusa (opcional):') || ''
                    acao('studio', s.id, 'recusar', motivo)
                  }}>
                    ❌ Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Fan-Dubs pendentes */}
          <div className="admin-section">
            <div className="admin-section-title">
              🎬 Fan-Dubs Pendentes
              <span className="admin-count">{dados.fanDubs?.length || 0}</span>
            </div>

            {!dados.fanDubs?.length ? (
              <div className="admin-empty">Nenhum fan-dub pendente</div>
            ) : dados.fanDubs.map(d => (
              <div key={d.id} className="admin-card">
                <div className="admin-card-header">
                  {d.capa || d.animeCapa ? (
                    <img src={d.capa || d.animeCapa} alt={d.titulo}
                      className="admin-card-thumb"
                      onError={e => e.target.style.display='none'} />
                  ) : (
                    <div className="admin-card-icon">🎬</div>
                  )}
                  <div className="admin-card-info">
                    <div className="admin-card-nome">{d.titulo}</div>
                    <div className="admin-card-email">🎌 {d.animeTitulo}</div>
                    <div className="admin-card-email">🎙️ {d.studioNome}</div>
                    <div className="admin-card-date">
                      {d.episodios} ep(s) • {d.qualidade} • {new Date(d.criadoEm).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {d.descricao && (
                  <div className="admin-card-desc">{d.descricao}</div>
                )}

                <div className="admin-card-meta">
                  🔗 <a href={d.embedUrl} target="_blank" rel="noopener noreferrer">
                    Ver player
                  </a>
                </div>

                {d.direitos && (
                  <div className="admin-card-meta">⚖️ {d.direitos}</div>
                )}

                <div className="admin-card-btns">
                  <button className="admin-approve" onClick={() => acao('fanDub', d.id, 'aprovar')}>
                    ✅ Aprovar
                  </button>
                  <button className="admin-reject" onClick={() => {
                    const motivo = prompt('Motivo da recusa (opcional):') || ''
                    acao('fanDub', d.id, 'recusar', motivo)
                  }}>
                    ❌ Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
