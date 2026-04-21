import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminRecompensas.css'

const API      = 'https://rewards-proxy.masterotaku487.workers.dev'
const AUTH_KEY = 'upanime_admin_rewards'

const TIPOS = ['cargo','cor','vip','conquista','xp','titulo','custom']
const DICAS = {
  cargo:     'Nome do cargo (ex: Fundador, Beta Tester, VIP Original)',
  cor:       'Cor hex (ex: #FFD600 para amarelo, #E53935 para vermelho)',
  vip:       'Dias de VIP (0 = eterno)',
  conquista: 'ID da conquista (ex: beta_tester, fundador)',
  xp:        'Quantidade de XP (ex: 500)',
  titulo:    'Texto do título (ex: Pioneiro, Lenda)',
  custom:    'Texto livre da recompensa',
}

export default function AdminRecompensas() {
  const nav = useNavigate()
  const [authed, setAuthed]   = useState(!!localStorage.getItem(AUTH_KEY))
  const [senha, setSenha]     = useState('')
  const [secret, setSecret]   = useState(localStorage.getItem(AUTH_KEY) || '')
  const [codigos, setCodigos] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    codigo: '', descricao: '', usos: 1, expira: '',
    recompensas: [{ tipo: 'vip', valor: '0' }]
  })

  useEffect(() => { if (authed) carregar() }, [authed])

  const login = async () => {
    const r = await fetch(`${API}/admin/codigos`, {
      headers: { 'Authorization': `Bearer ${senha}` }
    })
    if (r.ok) {
      localStorage.setItem(AUTH_KEY, senha)
      setSecret(senha); setAuthed(true)
    } else { setMsg('Senha incorreta!') }
  }

  const carregar = async () => {
    setLoading(true)
    const r = await fetch(`${API}/admin/codigos`, {
      headers: { 'Authorization': `Bearer ${secret}` }
    })
    const d = await r.json()
    setCodigos(d.codigos || [])
    setLoading(false)
  }

  const criar = async () => {
    setLoading(true); setMsg('')
    const body = {
      ...form,
      usos:  parseInt(form.usos) || 0,
      expira: form.expira || null,
      codigo: form.codigo.toUpperCase().trim() || undefined,
    }
    const r = await fetch(`${API}/admin/criar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const d = await r.json()
    if (d.ok) {
      setMsg(`✅ Código criado: ${d.code}`)
      setShowForm(false)
      setForm({ codigo:'', descricao:'', usos:1, expira:'', recompensas:[{ tipo:'vip', valor:'0' }] })
      carregar()
    } else { setMsg(`❌ ${d.error}`) }
    setLoading(false)
  }

  const deletar = async (code) => {
    if (!confirm(`Apagar código ${code}?`)) return
    await fetch(`${API}/admin/codigos/${code}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${secret}` }
    })
    carregar()
  }

  const addRecompensa = () => setForm(f => ({ ...f, recompensas: [...f.recompensas, { tipo: 'xp', valor: '100' }] }))
  const updR = (i, k, v) => setForm(f => { const r = [...f.recompensas]; r[i] = { ...r[i], [k]: v }; return { ...f, recompensas: r } })
  const delR = (i) => setForm(f => ({ ...f, recompensas: f.recompensas.filter((_,idx) => idx !== i) }))

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code)
    setMsg(`📋 Copiado: ${code}`)
    setTimeout(() => setMsg(''), 2000)
  }

  if (!authed) return (
    <div className="ar-login">
      <div className="ar-login-card">
        <div style={{fontSize:'3rem',marginBottom:12}}>🎁</div>
        <h1>Admin Recompensas</h1>
        <input className="ar-input" type="password" placeholder="Senha admin"
          value={senha} onChange={e => setSenha(e.target.value)}
          onKeyDown={e => e.key==='Enter' && login()} />
        {msg && <div style={{color:'#ff5252',fontSize:'.85rem'}}>{msg}</div>}
        <button className="ar-btn" onClick={login}>Entrar</button>
      </div>
    </div>
  )

  return (
    <div className="ar-page">
      <div className="ar-header">
        <button className="ar-back" onClick={() => nav(-1)}>‹</button>
        <div>
          <h1 className="ar-title">🎁 Admin Recompensas</h1>
          <p className="ar-sub">{codigos.length} código(s) criado(s)</p>
        </div>
        <div className="ar-header-right">
          <button className="ar-refresh" onClick={carregar}>🔄</button>
          <button className="ar-logout" onClick={() => { localStorage.removeItem(AUTH_KEY); setAuthed(false) }}>Sair</button>
        </div>
      </div>

      {msg && <div className="ar-toast">{msg}</div>}

      <button className="ar-btn" onClick={() => setShowForm(s => !s)}>
        {showForm ? '✕ Cancelar' : '+ Criar novo código'}
      </button>

      {/* Formulário de criação */}
      {showForm && (
        <div className="ar-form">
          <div className="ar-form-title">Novo código de recompensa</div>

          <label className="ar-label">Código personalizado (opcional)</label>
          <input className="ar-input" placeholder="UP-ESPECIAL (vazio = gerado automaticamente)"
            value={form.codigo} onChange={e => setForm({...form,codigo:e.target.value.toUpperCase()})} />

          <label className="ar-label">Descrição (aparece para o usuário)</label>
          <input className="ar-input" placeholder="ex: Recompensa exclusiva para fundadores"
            value={form.descricao} onChange={e => setForm({...form,descricao:e.target.value})} />

          <div className="ar-row">
            <div style={{flex:1}}>
              <label className="ar-label">Usos máximos</label>
              <input className="ar-input" type="number" placeholder="0 = ilimitado"
                value={form.usos} onChange={e => setForm({...form,usos:e.target.value})} />
            </div>
            <div style={{flex:1}}>
              <label className="ar-label">Expira em (opcional)</label>
              <input className="ar-input" type="date"
                value={form.expira} onChange={e => setForm({...form,expira:e.target.value})} />
            </div>
          </div>

          <label className="ar-label">Recompensas</label>
          {form.recompensas.map((r,i) => (
            <div key={i} className="ar-recompensa-row">
              <select className="ar-select" value={r.tipo} onChange={e => updR(i,'tipo',e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="ar-input-sm" placeholder={DICAS[r.tipo]}
                value={r.valor} onChange={e => updR(i,'valor',e.target.value)} />
              {form.recompensas.length > 1 && (
                <button className="ar-del-r" onClick={() => delR(i)}>✕</button>
              )}
            </div>
          ))}
          <button className="ar-add-r" onClick={addRecompensa}>+ Adicionar recompensa</button>

          <button className="ar-btn" onClick={criar} disabled={loading}>
            {loading ? '⏳...' : '✅ Criar código'}
          </button>
        </div>
      )}

      {/* Lista de códigos */}
      <div className="ar-codigos">
        {loading && !codigos.length ? (
          <p className="ar-loading">Carregando...</p>
        ) : codigos.map(c => (
          <div key={c.code} className="ar-code-card">
            <div className="ar-code-top">
              <div className="ar-code-value" onClick={() => copyCode(c.code)}>
                {c.code} <span className="ar-copy">📋</span>
              </div>
              <button className="ar-del" onClick={() => deletar(c.code)}>🗑️</button>
            </div>
            <div className="ar-code-desc">{c.descricao}</div>
            <div className="ar-code-meta">
              <span>🔢 {c.usosFeitos}/{c.usos || '∞'} usos</span>
              {c.expira && <span>📅 Expira {new Date(c.expira).toLocaleDateString('pt-BR')}</span>}
              <span>👥 {c.usadoPor?.length || 0} pessoas</span>
            </div>
            <div className="ar-code-rewards">
              {c.recompensas?.map((r,i) => (
                <span key={i} className="ar-code-reward-tag">
                  {r.tipo === 'cargo' ? '🏅' : r.tipo === 'cor' ? '🎨' : r.tipo === 'vip' ? '💎' : r.tipo === 'conquista' ? '🏆' : r.tipo === 'xp' ? '⭐' : r.tipo === 'titulo' ? '✨' : '🎁'}
                  {r.tipo}: {r.valor}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
