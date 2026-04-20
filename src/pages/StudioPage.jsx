import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './StudioPage.css'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

const FORM_VAZIO = {
  animeTitulo: '', animeCapa: '', titulo: '', descricao: '',
  embedUrl: '', downloadUrl: '', episodios: 1,
  qualidade: 'HD', direitos: '', capa: '', tags: '', elenco: ''
}

export default function StudioPage() {
  const nav = useNavigate()
  const [tab, setTab]           = useState('login')
  const [studio, setStudio]     = useState(null)
  const [fanDubs, setFanDubs]   = useState([])
  const [form, setForm]         = useState({ nome: '', email: '', senha: '', descricao: '', discord: '' })
  const [dubForm, setDubForm]   = useState(FORM_VAZIO)
  const [modoEps, setModoEps]   = useState('simples')
  // lista visual de episódios: [{ep, titulo, url}]
  const [epsRows, setEpsRows]   = useState([{ ep: 1, titulo: '', url: '' }])
  const [editingDub, setEditingDub] = useState(null)
  const [msg, setMsg]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [showDubForm, setShowDubForm] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────
  const login = async () => {
    setLoading(true); setMsg('')
    const r = await fetch(`${API}/api/studio/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  // ── Episódios (builder visual) ────────────────────────────────────
  const addEpsRow = () =>
    setEpsRows(rows => [...rows, { ep: rows.length + 1, titulo: '', url: '' }])

  const removeEpsRow = (i) =>
    setEpsRows(rows => rows.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, ep: idx + 1 })))

  const updateEpsRow = (i, campo, val) =>
    setEpsRows(rows => rows.map((r, idx) => idx === i ? { ...r, [campo]: val } : r))

  // ── Editar dub existente ──────────────────────────────────────────
  const startEdit = (dub) => {
    setEditingDub(dub)
    setDubForm({
      animeTitulo:  dub.animeTitulo || '',
      animeCapa:    dub.animeCapa   || '',
      titulo:       dub.titulo      || '',
      descricao:    dub.descricao   || '',
      embedUrl:     dub.embedUrl    || '',
      downloadUrl:  dub.downloadUrl || '',
      episodios:    dub.episodios   || 1,
      qualidade:    dub.qualidade   || 'HD',
      direitos:     dub.direitos    || '',
      capa:         dub.capa        || '',
      tags:         (dub.tags   || []).join(', '),
      elenco:       (dub.elenco || []).map(e => `${e.personagem}: ${e.dublador}`).join('\n'),
    })
    if (dub.listaEpisodios?.length > 0) {
      setModoEps('lista')
      setEpsRows(dub.listaEpisodios.map(e => ({
        ep:     e.ep    || 1,
        titulo: e.titulo || '',
        url:    e.url   || '',
      })))
    } else {
      setModoEps('simples')
      setEpsRows([{ ep: 1, titulo: '', url: '' }])
    }
    setShowDubForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicao = () => {
    setEditingDub(null)
    setDubForm(FORM_VAZIO)
    setEpsRows([{ ep: 1, titulo: '', url: '' }])
    setModoEps('simples')
    setShowDubForm(false)
    setMsg('')
  }

  // ── Deletar fan-dub ──────────────────────────────────────────────
  const deletarFanDub = async (dub) => {
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir "${dub.titulo}"?\n\nEssa ação não pode ser desfeita.`
    )
    if (!confirmado) return
    const r = await fetch(`${API}/api/fanDubs/${dub.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${studio.studioId}` },
    })
    const d = await r.json()
    if (d.ok) {
      setMsg('🗑️ Fan-dub excluído.')
      carregarFanDubs()
    } else {
      setMsg(d.error || 'Erro ao excluir')
    }
  }

  // ── Enviar / Atualizar fan-dub ────────────────────────────────────
  const enviarFanDub = async () => {
    setLoading(true); setMsg('')

    const elenco = dubForm.elenco.split('\n').filter(Boolean).map(l => {
      const [personagem, dublador] = l.split(':').map(s => s.trim())
      return { personagem: personagem || l, dublador: dublador || '' }
    })
    const tags = dubForm.tags.split(',').map(t => t.trim()).filter(Boolean)

    const listaEpisodios = modoEps === 'lista'
      ? epsRows.filter(r => r.url).map(r => ({
          ep:     parseInt(r.ep) || 1,
          titulo: r.titulo || `Episódio ${r.ep}`,
          url:    r.url,
        }))
      : []

    const body = {
      ...dubForm,
      episodios:      listaEpisodios.length || parseInt(dubForm.episodios),
      elenco,
      tags,
      listaEpisodios,
    }

    const isEdit = !!editingDub
    const endpoint = isEdit
      ? `${API}/api/fanDubs/${editingDub.id}`
      : `${API}/api/fanDubs`

    const r = await fetch(endpoint, {
      method:  isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studio.studioId}` },
      body:    JSON.stringify(body),
    })
    const d = await r.json()
    if (d.ok) {
      setMsg(isEdit
        ? '✅ Fan-dub atualizado! Aguarde nova revisão.'
        : '✅ Fan-dub enviado para revisão!')
      cancelarEdicao()
      carregarFanDubs()
    } else { setMsg(d.error || 'Erro ao salvar') }
    setLoading(false)
  }

  const statusColor = { aprovado: '#00E676', pendente: '#FFD600', recusado: '#E53935' }

  return (
    <div className="studio-page">
      <div className="studio-header">
        <button className="studio-back" onClick={() => nav(-1)}>‹</button>
        <h1 className="studio-title">🎙️ Área do Estúdio</h1>
      </div>

      {tab !== 'painel' && (
        <div className="studio-tabs">
          <div className={`stab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Entrar</div>
          <div className={`stab ${tab === 'registrar' ? 'active' : ''}`} onClick={() => setTab('registrar')}>Cadastrar</div>
        </div>
      )}

      {/* ── LOGIN ── */}
      {tab === 'login' && (
        <div className="studio-form">
          <p className="studio-form-sub">Acesse o painel do seu estúdio</p>
          <input className="studio-input" placeholder="Email" type="email"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="studio-input" placeholder="Senha" type="password"
            value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
          {msg && <div className="studio-msg">{msg}</div>}
          <button className="studio-btn" onClick={login} disabled={loading}>
            {loading ? '⏳ Entrando...' : 'Entrar'}
          </button>
        </div>
      )}

      {/* ── REGISTRAR ── */}
      {tab === 'registrar' && (
        <div className="studio-form">
          <p className="studio-form-sub">Solicite acesso para divulgar seu fan-dub</p>
          <input className="studio-input" placeholder="Nome do estúdio *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <input className="studio-input" placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="studio-input" placeholder="Senha *" type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
          <textarea className="studio-input" placeholder="Descrição do estúdio" rows={3} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          <input className="studio-input" placeholder="Discord (ex: discord.gg/seuserver)" value={form.discord} onChange={e => setForm({ ...form, discord: e.target.value })} />
          {msg && <div className="studio-msg">{msg}</div>}
          <button className="studio-btn" onClick={registrar} disabled={loading}>
            {loading ? '⏳...' : '📨 Enviar Solicitação'}
          </button>
          <p className="studio-nota">A equipe UpAnime+ analisará sua solicitação em até 48h.</p>
        </div>
      )}

      {/* ── PAINEL ── */}
      {tab === 'painel' && studio && (
        <div className="studio-painel">
          <div className="painel-welcome">
            <div className="painel-avatar">🎙️</div>
            <div>
              <div className="painel-nome">{studio.nome}</div>
              <div className="painel-status" style={{ color: statusColor[studio.status] }}>
                ● {studio.status}
              </div>
            </div>
            <button className="painel-logout" onClick={() => {
              setStudio(null); setTab('login'); localStorage.removeItem('studio_token')
            }}>Sair</button>
          </div>

          <div className="painel-stats">
            <div className="pstat"><div className="pstat-val">{fanDubs.length}</div><div className="pstat-label">Fan-Dubs</div></div>
            <div className="pstat"><div className="pstat-val">{fanDubs.filter(d => d.status === 'aprovado').length}</div><div className="pstat-label">Aprovados</div></div>
            <div className="pstat"><div className="pstat-val">{fanDubs.filter(d => d.status === 'pendente').length}</div><div className="pstat-label">Pendentes</div></div>
          </div>

          {!showDubForm && (
            <button className="studio-btn" onClick={() => { cancelarEdicao(); setShowDubForm(true) }}>
              + Enviar Novo Fan-Dub
            </button>
          )}

          {/* ── FORMULÁRIO (novo ou edição) ── */}
          {showDubForm && (
            <div className="dub-form">
              <h3 className="dub-form-title">
                {editingDub ? '✏️ Editar Fan-Dub' : '📤 Novo Fan-Dub'}
              </h3>

              <input className="studio-input" placeholder="Anime (título original) *"
                value={dubForm.animeTitulo} onChange={e => setDubForm({ ...dubForm, animeTitulo: e.target.value })} />
              <input className="studio-input" placeholder="URL da capa do anime"
                value={dubForm.animeCapa} onChange={e => setDubForm({ ...dubForm, animeCapa: e.target.value })} />
              <input className="studio-input" placeholder="Título do fan-dub *"
                value={dubForm.titulo} onChange={e => setDubForm({ ...dubForm, titulo: e.target.value })} />
              <textarea className="studio-input" placeholder="Descrição" rows={3}
                value={dubForm.descricao} onChange={e => setDubForm({ ...dubForm, descricao: e.target.value })} />

              {/* ── Modo Episódios ── */}
              <div className="eps-section-title">🎬 Episódios</div>
              <div className="eps-modo-toggle">
                <button className={`eps-modo-btn ${modoEps === 'simples' ? 'active' : ''}`}
                  onClick={() => setModoEps('simples')}>
                  🔗 Uma URL para todos
                </button>
                <button className={`eps-modo-btn ${modoEps === 'lista' ? 'active' : ''}`}
                  onClick={() => setModoEps('lista')}>
                  📋 URL por episódio
                </button>
              </div>

              {modoEps === 'simples' ? (
                <>
                  <input className="studio-input" placeholder="URL do player/embed * (ex: Drive, YouTube...)"
                    value={dubForm.embedUrl} onChange={e => setDubForm({ ...dubForm, embedUrl: e.target.value })} />
                  <input className="studio-input" placeholder="Número de episódios" type="number"
                    value={dubForm.episodios} onChange={e => setDubForm({ ...dubForm, episodios: e.target.value })} />
                </>
              ) : (
                <div className="eps-builder">
                  <p className="eps-builder-hint">
                    Adicione cada episódio com seu número, título e link de vídeo.
                  </p>
                  {epsRows.map((row, i) => (
                    <div key={i} className="eps-row">
                      <div className="eps-row-num-wrap">
                        <span className="eps-row-label">EP</span>
                        <input
                          className="studio-input eps-row-num"
                          type="number"
                          value={row.ep}
                          onChange={e => updateEpsRow(i, 'ep', e.target.value)}
                        />
                      </div>
                      <div className="eps-row-fields">
                        <input
                          className="studio-input"
                          placeholder="Título do episódio (opcional)"
                          value={row.titulo}
                          onChange={e => updateEpsRow(i, 'titulo', e.target.value)}
                        />
                        <input
                          className="studio-input"
                          placeholder="URL do vídeo *"
                          value={row.url}
                          onChange={e => updateEpsRow(i, 'url', e.target.value)}
                        />
                      </div>
                      {epsRows.length > 1 && (
                        <button className="eps-row-remove" onClick={() => removeEpsRow(i)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button className="eps-add-btn" onClick={addEpsRow}>
                    + Adicionar Episódio
                  </button>
                </div>
              )}

              <input className="studio-input" placeholder="URL de download (opcional)"
                value={dubForm.downloadUrl} onChange={e => setDubForm({ ...dubForm, downloadUrl: e.target.value })} />
              <input className="studio-input" placeholder="URL da capa do fan-dub (se diferente do anime)"
                value={dubForm.capa} onChange={e => setDubForm({ ...dubForm, capa: e.target.value })} />
              <select className="studio-input" value={dubForm.qualidade}
                onChange={e => setDubForm({ ...dubForm, qualidade: e.target.value })}>
                <option>HD</option><option>Full HD</option><option>4K</option><option>SD</option>
              </select>
              <textarea className="studio-input"
                placeholder={'Elenco (um por linha):\nNaruto: João Silva\nSasuke: Maria Souza'}
                rows={4} value={dubForm.elenco}
                onChange={e => setDubForm({ ...dubForm, elenco: e.target.value })} />
              <input className="studio-input" placeholder="Tags (separadas por vírgula, ex: Ação, Shounen)"
                value={dubForm.tags} onChange={e => setDubForm({ ...dubForm, tags: e.target.value })} />
              <textarea className="studio-input"
                placeholder="Aviso de direitos autorais (ex: © 2025 Studio X. Fan-dub não oficial.)"
                rows={2} value={dubForm.direitos}
                onChange={e => setDubForm({ ...dubForm, direitos: e.target.value })} />

              {msg && <div className="studio-msg">{msg}</div>}

              <div className="dub-form-actions">
                <button className="studio-btn-secondary" onClick={cancelarEdicao}>
                  ✕ Cancelar
                </button>
                <button className="studio-btn" onClick={enviarFanDub} disabled={loading}>
                  {loading ? '⏳ Salvando...' : editingDub ? '💾 Salvar Alterações' : '📤 Enviar para Revisão'}
                </button>
              </div>
            </div>
          )}

          {msg && !showDubForm && <div className="studio-msg" style={{marginBottom:8}}>{msg}</div>}

          {/* ── LISTA DE DUBS ── */}
          <div className="dubs-list">
            <h3 className="dubs-list-title">Meus Fan-Dubs</h3>
            {fanDubs.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '.88rem' }}>Nenhum fan-dub enviado ainda.</p>
            ) : fanDubs.map(d => (
              <div key={d.id} className="dub-item">
                <img src={d.capa || d.animeCapa} alt={d.titulo} className="dub-item-img"
                  onError={e => e.target.style.display = 'none'} />
                <div className="dub-item-info">
                  <div className="dub-item-anime">{d.animeTitulo}</div>
                  <div className="dub-item-titulo">{d.titulo}</div>
                  <div className="dub-item-meta">
                    <span className="dub-item-eps">
                      📺 {d.listaEpisodios?.length || d.episodios || 1} EP{(d.listaEpisodios?.length || d.episodios || 1) > 1 ? 'S' : ''}
                    </span>
                    <span className="dub-item-status" style={{ color: statusColor[d.status] }}>
                      ● {d.status}
                    </span>
                  </div>
                </div>
                <div className="dub-item-actions">
                  <button className="dub-item-edit-btn" onClick={() => startEdit(d)}
                    title="Editar / Adicionar episódios">
                    ✏️
                  </button>
                  <button className="dub-item-delete-btn" onClick={() => deletarFanDub(d)}
                    title="Excluir fan-dub">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
