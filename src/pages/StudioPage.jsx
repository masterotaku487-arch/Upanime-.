import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './StudioPage.css'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

export default function StudioPage() {
  const nav  = useNavigate()
  const [tab, setTab] = useState('login')  // login | registrar | painel
  const [studio, setStudio] = useState(null)
  const [fanDubs, setFanDubs] = useState([])
  const [form, setForm] = useState({ nome:'', email:'', senha:'', descricao:'', discord:'' })
  const [dubForm, setDubForm] = useState({ animeTitulo:'', animeCapa:'', titulo:'', descricao:'', embedUrl:'', downloadUrl:'', episodios:1, qualidade:'HD', direitos:'', capa:'', tags:'', elenco:'', listaEps:'' })
  const [modoEps, setModoEps] = useState('simples') // simples | lista
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDubForm, setShowDubForm] = useState(false)

  const login = async () => {
    setLoading(true); setMsg('')
    const r = await fetch(`${API}/api/studio/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: form.email, senha: form.senha })
    })
    const d = await r.json()
    if (d.ok) {
      setStudio(d)
      localStorage.setItem('studio_token', d.studioId)
      carregarFanDubs(d.studioId)
      setTab('painel')
    } else { setMsg(d.error || 'Erro no login') }
    setLoading(false)
  }

  const registrar = async () => {
    setLoading(true); setMsg('')
    const r = await fetch(`${API}/api/studio/registrar`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form)
    })
    const d = await r.json()
    if (d.ok) { setMsg('✅ Solicitação enviada! Aguarde aprovação da equipe UpAnime+.') }
    else { setMsg(d.error || 'Erro ao registrar') }
    setLoading(false)
  }

  const carregarFanDubs = async (studioId) => {
    const token = studioId || studio?.studioId
    const r = await fetch(`${API}/api/studio/meusFanDubs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const d = await r.json()
    setFanDubs(d.fanDubs || [])
  }

  const enviarFanDub = async () => {
    setLoading(true); setMsg('')
    const elenco = dubForm.elenco.split('\n').filter(Boolean).map(l => {
      const [personagem, dublador] = l.split(':').map(s => s.trim())
      return { personagem: personagem || l, dublador: dublador || '' }
    })
    const tags = dubForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    // Lista de episódios: "1|Titulo EP1|https://drive..." um por linha
    const listaEpisodios = modoEps === 'lista'
      ? dubForm.listaEps.split('\n').filter(Boolean).map((linha, i) => {
          const partes = linha.split('|').map(s => s.trim())
          return { ep: parseInt(partes[0]) || i+1, titulo: partes[1] || `Episódio ${i+1}`, url: partes[2] || dubForm.embedUrl }
        })
      : []
    const body = { ...dubForm, episodios: listaEpisodios.length || parseInt(dubForm.episodios), elenco, tags, listaEpisodios }
    const r = await fetch(`${API}/api/fanDubs`, {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${studio.studioId}` },
      body: JSON.stringify(body)
    })
    const d = await r.json()
    if (d.ok) {
      setMsg('✅ Fan-dub enviado para revisão!')
      setShowDubForm(false)
      carregarFanDubs()
    } else { setMsg(d.error || 'Erro ao enviar') }
    setLoading(false)
  }

  const statusColor = { aprovado:'#00E676', pendente:'#FFD600', recusado:'#E53935' }

  return (
    <div className="studio-page">
      <div className="studio-header">
        <button className="studio-back" onClick={() => nav(-1)}>‹</button>
        <h1 className="studio-title">🎙️ Área do Estúdio</h1>
      </div>

      {tab !== 'painel' && (
        <div className="studio-tabs">
          <div className={`stab ${tab==='login'?'active':''}`} onClick={() => setTab('login')}>Entrar</div>
          <div className={`stab ${tab==='registrar'?'active':''}`} onClick={() => setTab('registrar')}>Cadastrar</div>
        </div>
      )}

      {/* LOGIN */}
      {tab === 'login' && (
        <div className="studio-form">
          <p className="studio-form-sub">Acesse o painel do seu estúdio</p>
          <input className="studio-input" placeholder="Email" type="email"
            value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
          <input className="studio-input" placeholder="Senha" type="password"
            value={form.senha} onChange={e => setForm({...form, senha:e.target.value})} />
          {msg && <div className="studio-msg">{msg}</div>}
          <button className="studio-btn" onClick={login} disabled={loading}>
            {loading ? '⏳ Entrando...' : 'Entrar'}
          </button>
        </div>
      )}

      {/* REGISTRAR */}
      {tab === 'registrar' && (
        <div className="studio-form">
          <p className="studio-form-sub">Solicite acesso para divulgar seu fan-dub</p>
          <input className="studio-input" placeholder="Nome do estúdio *" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} />
          <input className="studio-input" placeholder="Email *" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          <input className="studio-input" placeholder="Senha *" type="password" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} />
          <textarea className="studio-input" placeholder="Descrição do estúdio" rows={3} value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} />
          <input className="studio-input" placeholder="Discord (ex: discord.gg/seuserver)" value={form.discord} onChange={e=>setForm({...form,discord:e.target.value})} />
          {msg && <div className="studio-msg">{msg}</div>}
          <button className="studio-btn" onClick={registrar} disabled={loading}>
            {loading ? '⏳...' : '📨 Enviar Solicitação'}
          </button>
          <p className="studio-nota">A equipe UpAnime+ analisará sua solicitação em até 48h.</p>
        </div>
      )}

      {/* PAINEL */}
      {tab === 'painel' && studio && (
        <div className="studio-painel">
          <div className="painel-welcome">
            <div className="painel-avatar">🎙️</div>
            <div>
              <div className="painel-nome">{studio.nome}</div>
              <div className="painel-status" style={{color: statusColor[studio.status]}}>
                ● {studio.status}
              </div>
            </div>
            <button className="painel-logout" onClick={() => { setStudio(null); setTab('login'); localStorage.removeItem('studio_token') }}>Sair</button>
          </div>

          <div className="painel-stats">
            <div className="pstat"><div className="pstat-val">{fanDubs.length}</div><div className="pstat-label">Fan-Dubs</div></div>
            <div className="pstat"><div className="pstat-val">{fanDubs.filter(d=>d.status==='aprovado').length}</div><div className="pstat-label">Aprovados</div></div>
            <div className="pstat"><div className="pstat-val">{fanDubs.filter(d=>d.status==='pendente').length}</div><div className="pstat-label">Pendentes</div></div>
          </div>

          <button className="studio-btn" onClick={() => setShowDubForm(s => !s)}>
            {showDubForm ? '✕ Cancelar' : '+ Enviar Novo Fan-Dub'}
          </button>

          {showDubForm && (
            <div className="dub-form">
              <h3 className="dub-form-title">📤 Novo Fan-Dub</h3>
              <input className="studio-input" placeholder="Anime (título original) *" value={dubForm.animeTitulo} onChange={e=>setDubForm({...dubForm,animeTitulo:e.target.value})} />
              <input className="studio-input" placeholder="URL da capa do anime" value={dubForm.animeCapa} onChange={e=>setDubForm({...dubForm,animeCapa:e.target.value})} />
              <input className="studio-input" placeholder="Título do fan-dub *" value={dubForm.titulo} onChange={e=>setDubForm({...dubForm,titulo:e.target.value})} />
              <textarea className="studio-input" placeholder="Descrição" rows={3} value={dubForm.descricao} onChange={e=>setDubForm({...dubForm,descricao:e.target.value})} />
              <div className="eps-modo-toggle">
                <button className={`eps-modo-btn ${modoEps==='simples'?'active':''}`} onClick={()=>setModoEps('simples')}>1 URL para todos os EPs</button>
                <button className={`eps-modo-btn ${modoEps==='lista'?'active':''}`} onClick={()=>setModoEps('lista')}>URL por episódio</button>
              </div>
              {modoEps === 'simples' ? (
                <input className="studio-input" placeholder="URL do player/embed * (ex: Drive, YouTube...)" value={dubForm.embedUrl} onChange={e=>setDubForm({...dubForm,embedUrl:e.target.value})} />
              ) : (
                <textarea className="studio-input" placeholder={"URL por episódio (uma por linha):\n1|Título EP1|https://drive.google.com/...\n2|Título EP2|https://drive.google.com/..."} rows={6} value={dubForm.listaEps} onChange={e=>setDubForm({...dubForm,listaEps:e.target.value})} />
              )}
              <input className="studio-input" placeholder="URL de download (opcional)" value={dubForm.downloadUrl} onChange={e=>setDubForm({...dubForm,downloadUrl:e.target.value})} />
              <input className="studio-input" placeholder="URL da capa do fan-dub (se diferente do anime)" value={dubForm.capa} onChange={e=>setDubForm({...dubForm,capa:e.target.value})} />
              <input className="studio-input" placeholder="Número de episódios" type="number" value={dubForm.episodios} onChange={e=>setDubForm({...dubForm,episodios:e.target.value})} />
              <select className="studio-input" value={dubForm.qualidade} onChange={e=>setDubForm({...dubForm,qualidade:e.target.value})}>
                <option>HD</option><option>Full HD</option><option>4K</option><option>SD</option>
              </select>
              <textarea className="studio-input" placeholder="Elenco (um por linha, ex: Naruto: João Silva)" rows={4} value={dubForm.elenco} onChange={e=>setDubForm({...dubForm,elenco:e.target.value})} />
              <input className="studio-input" placeholder="Tags (separadas por vírgula, ex: Ação, Shounen)" value={dubForm.tags} onChange={e=>setDubForm({...dubForm,tags:e.target.value})} />
              <textarea className="studio-input" placeholder="Aviso de direitos autorais (ex: © 2025 Studio X. Fan-dub não oficial.)" rows={2} value={dubForm.direitos} onChange={e=>setDubForm({...dubForm,direitos:e.target.value})} />
              {msg && <div className="studio-msg">{msg}</div>}
              <button className="studio-btn" onClick={enviarFanDub} disabled={loading}>
                {loading ? '⏳ Enviando...' : '📤 Enviar para Revisão'}
              </button>
            </div>
          )}

          <div className="dubs-list">
            <h3 className="dubs-list-title">Meus Fan-Dubs</h3>
            {fanDubs.length === 0 ? (
              <p style={{color:'var(--muted)',fontSize:'.88rem'}}>Nenhum fan-dub enviado ainda.</p>
            ) : fanDubs.map(d => (
              <div key={d.id} className="dub-item">
                <img src={d.capa||d.animeCapa} alt={d.titulo} className="dub-item-img"
                  onError={e=>e.target.style.display='none'} />
                <div className="dub-item-info">
                  <div className="dub-item-anime">{d.animeTitulo}</div>
                  <div className="dub-item-titulo">{d.titulo}</div>
                  <div className="dub-item-status" style={{color:statusColor[d.status]}}>● {d.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
