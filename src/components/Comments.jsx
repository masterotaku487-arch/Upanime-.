import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiHeart, FiTrash2, FiSend } from 'react-icons/fi'
import './Comments.css'

const WORKER = 'https://comments-proxy.masterotaku487.workers.dev'

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
  const { user, openLogin } = useAuth()
  const [comments, setComments] = useState([])
  const [likes,    setLikes]    = useState(0)
  const [liked,    setLiked]    = useState(false)
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const textareaRef = useRef(null)

  const fetchComments = async () => {
    try {
      const r = await fetch(`${WORKER}?action=list&anime=${animeId}&ep=${ep}`)
      const d = await r.json()
      setComments(d.comments || [])
      setLikes(d.likes || 0)
      // Checa se o usuário já curtiu (localStorage como cache local)
      if (user) {
        const likedKey = `liked_${user.id}_${animeId}_${ep}`
        setLiked(!!localStorage.getItem(likedKey))
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    setLoading(true)
    setComments([])
    fetchComments()
  }, [animeId, ep])

  const handleLike = async () => {
    if (!user) { openLogin(); return }
    const likedKey = `liked_${user.id}_${animeId}_${ep}`
    try {
      const r = await fetch(`${WORKER}?action=like&anime=${animeId}&ep=${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const d = await r.json()
      setLikes(d.likes)
      setLiked(d.liked)
      if (d.liked) localStorage.setItem(likedKey, '1')
      else localStorage.removeItem(likedKey)
    } catch {}
  }

  const handleSend = async () => {
    if (!user) { openLogin(); return }
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      const r = await fetch(`${WORKER}?action=comment&anime=${animeId}&ep=${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name:   user.name,
          avatar: user.picture,
          text:   trimmed,
        }),
      })
      const d = await r.json()
      if (d.ok) {
        setComments(prev => [d.comment, ...prev])
        setText('')
        textareaRef.current?.focus()
      } else {
        alert(d.error || 'Erro ao enviar')
      }
    } catch {}
    finally { setSending(false) }
  }

  const handleDelete = async (commentId) => {
    if (!user) return
    if (!confirm('Apagar comentário?')) return
    try {
      await fetch(`${WORKER}?action=comment&anime=${animeId}&ep=${ep}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, commentId }),
      })
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {}
  }

  return (
    <div className="comments-section">
      {/* Botão de like do episódio */}
      <div className="comments-header">
        <h3 className="comments-title">💬 Comentários <span>({comments.length})</span></h3>
        <button className={`ep-like-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
          <FiHeart /> {likes > 0 && <span>{likes}</span>}
          {liked ? 'Curtido' : 'Curtir EP'}
        </button>
      </div>

      {/* Input de comentário */}
      <div className="comment-input-area">
        {user ? (
          <>
            <img src={user.picture} alt={user.name} className="comment-avatar" />
            <div className="comment-input-wrap">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="O que achou desse episódio?"
                maxLength={500}
                rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }}
              />
              <div className="comment-input-footer">
                <span className="comment-chars">{text.length}/500</span>
                <button className="comment-send-btn" onClick={handleSend} disabled={!text.trim() || sending}>
                  <FiSend /> {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <button className="comment-login-btn" onClick={openLogin}>
            🔒 Entre com Google para comentar
          </button>
        )}
      </div>

      {/* Lista de comentários */}
      <div className="comments-list">
        {loading && (
          <div className="comments-loading">
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
          </div>
        )}
        {!loading && comments.length === 0 && (
          <p className="comments-empty">Seja o primeiro a comentar! 👇</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="comment-item">
            <img src={c.avatar || '/logo.png'} alt={c.name} className="comment-avatar" />
            <div className="comment-body">
              <div className="comment-meta">
                <span className="comment-name">{c.name}</span>
                <span className="comment-time">{timeAgo(c.ts)}</span>
                {user?.id === c.userId && (
                  <button className="comment-del" onClick={() => handleDelete(c.id)} title="Apagar">
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
