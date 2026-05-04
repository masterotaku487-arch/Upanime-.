import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiHeart, FiTrash2, FiSend, FiAlertCircle, FiUser } from 'react-icons/fi'
import './Comments.css'

const WORKER = 'https://comments-proxy.masterotaku487.workers.dev'

function getAnonId() {
  let id = localStorage.getItem('upanime_anon_id')
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    localStorage.setItem('upanime_anon_id', id)
  }
  return id
}

const timeAgo = (ts) => {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function Comments({ animeId, ep }) {
  const { user, login } = useAuth()

  const [comments,    setComments]    = useState([])
  const [likes,       setLikes]       = useState(0)
  const [liked,       setLiked]       = useState(false)
  const [text,        setText]        = useState('')
  const [anonName,    setAnonName]    = useState(() => localStorage.getItem('upanime_anon_name') || '')
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState('')
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState(false)
  const [errMsg,      setErrMsg]      = useState('')
  const textareaRef = useRef(null)

  const authorId     = user ? user.id      : getAnonId()
  const authorName   = user ? user.name    : (anonName || 'Anônimo')
  const authorAvatar = user ? (user.picture || '') : ''
  const likedKey     = `liked_${authorId}_${animeId}_${ep}`

  const showErr = (msg) => { setErrMsg(msg); setTimeout(() => setErrMsg(''), 4000) }

  const fetchComments = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${WORKER}?action=list&anime=${animeId}&ep=${ep}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setComments(d.comments || [])
      setLikes(d.likes || 0)
      setLiked(!!localStorage.getItem(likedKey))
    } catch (e) {
      showErr('Erro ao carregar comentários: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setComments([]); setLiked(false); fetchComments() }, [animeId, ep])

  const handleLike = async () => {
    try {
      const r = await fetch(`${WORKER}?action=like&anime=${animeId}&ep=${ep}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authorId }),
      })
      const d = await r.json()
      if (d.error) { showErr(d.error); return }
      setLikes(d.likes); setLiked(d.liked)
      if (d.liked) localStorage.setItem(likedKey, '1')
      else         localStorage.removeItem(likedKey)
    } catch (e) { showErr('Erro ao curtir: ' + e.message) }
  }

  const saveAnonName = () => {
    const n = nameInput.trim() || 'Anônimo'
    localStorage.setItem('upanime_anon_name', n)
    setAnonName(n); setEditingName(false)
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true); setErrMsg('')
    try {
      const r = await fetch(`${WORKER}?action=comment&anime=${animeId}&ep=${ep}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authorId, name: authorName, avatar: authorAvatar, text: trimmed }),
      })
      const d = await r.json()
      if (!r.ok || d.error) { showErr(d.error || `Erro ${r.status}`); return }
      if (d.ok && d.comment) { setComments(prev => [d.comment, ...prev]); setText(''); textareaRef.current?.focus() }
    } catch (e) { showErr('Erro de conexão: ' + e.message) }
    finally { setSending(false) }
  }

  const handleDelete = async (commentId) => {
    if (!confirm('Apagar comentário?')) return
    try {
      const r = await fetch(`${WORKER}?action=comment&anime=${animeId}&ep=${ep}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authorId, commentId }),
      })
      const d = await r.json()
      if (d.ok) setComments(prev => prev.filter(c => c.id !== commentId))
      else showErr(d.error || 'Não foi possível apagar')
    } catch (e) { showErr('Erro: ' + e.message) }
  }

  return (
    <div className="comments-section">
      <div className="comments-header">
        <h3 className="comments-title">💬 Comentários <span>({comments.length})</span></h3>
        <button className={`ep-like-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
          <FiHeart /> {likes > 0 && <span>{likes}</span>} {liked ? 'Curtido' : 'Curtir EP'}
        </button>
      </div>

      {errMsg && <div className="comment-error"><FiAlertCircle size={14} /> {errMsg}</div>}

      <div className="comment-input-area">
        {user ? (
          <>
            <img src={user.picture} alt={user.name} className="comment-avatar" />
            <div className="comment-input-wrap">
              <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
                placeholder="O que achou desse episódio? (Ctrl+Enter para enviar)"
                maxLength={500} rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }} />
              <div className="comment-input-footer">
                <span className="comment-chars">{text.length}/500</span>
                <button className="comment-send-btn" onClick={handleSend} disabled={!text.trim() || sending}>
                  <FiSend /> {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="comment-anon-wrap">
            <div className="comment-anon-name-row">
              <FiUser size={14} />
              {editingName ? (
                <>
                  <input className="comment-anon-input" value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="Seu nome (opcional)" maxLength={30} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveAnonName() }} />
                  <button className="comment-anon-save" onClick={saveAnonName}>OK</button>
                </>
              ) : (
                <>
                  <span className="comment-anon-label">
                    Comentando como <strong>{authorName}</strong>
                  </span>
                  <button className="comment-anon-edit"
                    onClick={() => { setNameInput(anonName); setEditingName(true) }}>
                    mudar nome
                  </button>
                  <span className="comment-anon-or">ou</span>
                  <button className="comment-google-btn" onClick={login}>entrar com Google</button>
                </>
              )}
            </div>
            <div className="comment-input-wrap">
              <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
                placeholder="O que achou desse episódio? (Ctrl+Enter para enviar)"
                maxLength={500} rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }} />
              <div className="comment-input-footer">
                <span className="comment-chars">{text.length}/500</span>
                <button className="comment-send-btn" onClick={handleSend} disabled={!text.trim() || sending}>
                  <FiSend /> {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="comments-list">
        {loading && [1,2].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
        {!loading && comments.length === 0 && <p className="comments-empty">Seja o primeiro a comentar! 👇</p>}
        {comments.map(c => (
          <div key={c.id} className="comment-item">
            <img src={c.avatar || '/logo.png'} alt={c.name} className="comment-avatar" />
            <div className="comment-body">
              <div className="comment-meta">
                <span className="comment-name">{c.name}</span>
                <span className="comment-time">{timeAgo(c.ts)}</span>
                {authorId === c.userId && (
                  <button className="comment-del" onClick={() => handleDelete(c.id)}>
                    <FiTrash2 size={12} />
                  </button>
                )}
              </div>
              <p className="comment-text">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
