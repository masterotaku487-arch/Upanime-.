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

  // ── Aba ativa: pendentes de aprovação  ou  senhas de estúdios ─────────
  const [aba, setAba] = useState('pendentes')

  // ── Reset de senha por email (usa a rota que já existe) ───────────────
  const [resetEmail, setResetEmail]     = useState('')
  const [resetSenha, setResetSenha]     = useState('')
  const [resetMsg, setResetMsg]         = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // ── Ver senha (só dá pra decodificar a dos estúdios pendentes, que já
  //    vêm completos na resposta de /api/admin/pendentes) ───────────────
  const [senhasVisiveis, setSenhasVisiveis] = useState({})

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

  const decodeSenha = (hash) => {
    try { return atob(hash || '') } catch { return '(inválida)' }
  }

  const toggleSenha = (id) => {
    setSenhasVisiveis(v => ({ ...v, [id]: !v[id] }))
  }

  const usarEmailNoReset = (email) => {
    setResetEmail(email)
    setResetSenha('')
    setResetMsg('')
    setAba('estudios')
  }

  const resetarSenha = async () => {
    if (!resetEmail || !resetSenha || resetSenha.length < 6) {
      setResetMsg('❌ Preencha o email e uma senha com pelo menos 6 caracteres')
      return
    }
    setResetLoading(true); setResetMsg('')
    try {
      const r = await fetch(`${API}/api/admin/resetarSenha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
        body: JSON.stringify({ email: resetEmail, novaSenha: resetSenha }),
      })
      const d = await r.json()
      if (d.ok) {
        setResetMsg(`✅ Senha do estúdio "${d.nome}" resetada com sucesso!`)
        setResetSenha('')
      } else {
        setResetMsg(`❌ ${d.error || 'Erro ao resetar senha'}`)
      }
    } catch {
      setResetMsg('❌ Erro de conexão')
    }
    setResetLoading(false)
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

      <div className="admin-tabs">
        <button
          className={`admin-tab ${aba === 'pendentes' ? 'admin-tab-active' : ''}`}
          onClick={() => setAba('pendentes')}
        >
          ⏳ Pendentes
        </button>
        <button
          className={`admin-tab ${aba === 'estudios' ? 'admin-tab-active' : ''}`}
          onClick={() => setAba('estudios')}
        >
          🔑 Senhas
        </button>
      </div>

      {aba === 'estudios' ? (
        <div className="admin-section">
          <div className="admin-section-title">🔑 Resetar senha de um estúdio</div>
          <div className="admin-card">
            <input
              className="admin-input"
              type="email"
              placeholder="Email do estúdio"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
            />
            <input
              className="admin-input"
              type="text"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={resetSenha}
              onChange={e => setResetSenha(e.target.value)}
            />
            {resetMsg && <div className="admin-msg">{resetMsg}</div>}
            <button
              className="admin-btn"
              onClick={resetarSenha}
              disabled={resetLoading || !resetEmail || !resetSenha}
            >
              {resetLoading ? '⏳ Resetando...' : 'Resetar Senha'}
            </button>
          </div>

          <div className="admin-section-title admin-section-title-mt">
            🎙️ Estúdios pendentes
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
                </div>
              </div>

              <div className="admin-senha-row">
                <span className="admin-senha-label">Senha:</span>
                <span className="admin-senha-valor">
                  {senhasVisiveis[s.id] ? decodeSenha(s.senhaHash) : '••••••••'}
                </span>
                <button className="admin-mini-btn" onClick={() => toggleSenha(s.id)}>
                  {senhasVisiveis[s.id] ? '🙈 Esconder' : '👁️ Ver'}
                </button>
              </div>

              <button className="admin-reset-toggle" onClick={() => usarEmailNoReset(s.email)}>
                Usar este email no reset acima ↑
              </button>
            </div>
          ))}

          <p className="admin-note">
            A senha só aparece aqui pros estúdios pendentes (é o que a API já retorna).
            Pra estúdios já aprovados, o reset por email acima funciona normalmente —
            só não dá pra "ver" a senha atual deles sem mudar o worker.
          </p>
        </div>
      ) : loading ? (
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
