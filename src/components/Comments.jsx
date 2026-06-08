// src/components/Comments.jsx
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getComments, addComment, deleteComment,
  getLikes, addLike, removeLike,
} from '../services/supabase'
import './Comments.css'

const NEKOS_BASE = 'https://nekos.best/api/v2'
const GIF_CATEGORIES = ['hug', 'pat', 'wave', 'blush', 'smile', 'happy', 'wink', 'nod', 'nope', 'handshake']

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'agora'
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function Badge({ isAdmin, isVip, isGuest }) {
  if (isAdmin) return <span className="cmnt-badge cmnt-badge-admin">⚡ ADM</span>
  if (isVip)   return <span className="cmnt-badge cmnt-badge-vip">💎 VIP</span>
  if (isGuest) return <span className="cmnt-badge cmnt-badge-guest">👤 Visitante</span>
  return null
}

function GifPicker({ onSelect, onClose }) {
  const [category, setCategory] = useState('hug')
  const [gifs, setGifs]         = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${NEKOS_BASE}/${category}?amount=12`)
      .then(r => r.json())
      .then(d => setGifs(d.results || []))
      .catch(() => setGifs([]))
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div className="gif-picker">
      <div className="gif-picker-header">
        <span>🎭 Escolha um GIF</span>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="gif-categories">
        {GIF_CATEGORIES.map(c => (
          <button
            key={c}
            className={`gif-cat-btn ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >{c}</button>
        ))}
      </div>
      <div className="gif-grid">
        {loading
          ? Array(12).fill(0).map((_, i) => <div key={i} className="gif-skeleton" />)
          : gifs.map((g, i) => (
              <img
                key={i} src={g.url} alt={g.anime_name || 'gif'}
                className="gif-item"
                onClick={() => onSelect(g.url)}
                loading="lazy"
              />
            ))
        }
      </div>
    </div>
  )
}

function CommentItem({ c, currentUserId, isAdmin, onDelete }) {
  const [hearts, setHearts]   = useState(c._hearts || 0)
  const [hearted, setHearted] = useState(false)

  const handleHeart = () => {
    setHearted(h => !h)
    setHearts(n => hearted ? n - 1 : n + 1)
  }

  const canDelete = isAdmin || c.user_id === currentUserId

  return (
    <div className={`cmnt-item ${c.is_admin ? 'cmnt-admin-item' : ''} ${c.is_vip ? 'cmnt-vip-item' : ''}`}>
      <div className="cmnt-avatar-wrap">
        {c.avatar
          ? <img src={c.avatar} alt={c.name} className="cmnt-avatar" />
          : <div className="cmnt-avatar cmnt-avatar-default">{c.name[0]?.toUpperCase()}</div>
        }
      </div>
      <div className="cmnt-body">
        <div className="cmnt-meta">
          <span className="cmnt-name">{c.name}</span>
          <Badge isAdmin={c.is_admin} isVip={c.is_vip} isGuest={!c.is_admin && !c.is_vip && c.user_id?.startsWith('guest_')} />
          <span className="cmnt-time">{timeAgo(c.created_at)}</span>
        </div>
        {c.text && <p className="cmnt-text">{c.text}</p>}
        {c.gif_url && (
          <img src={c.gif_url} alt="gif" className="cmnt-gif" loading="lazy" />
        )}
        <div className="cmnt-actions">
          <button className={`cmnt-heart ${hearted ? 'active' : ''}`} onClick={handleHeart}>
            {hearted ? '❤️' : '🤍'} {hearts > 0 && hearts}
          </button>
          {canDelete && (
            <button className="cmnt-delete" onClick={() => onDelete(c.id, c.user_id)}>🗑️</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Comments({ animeId, ep = '1' }) {
  const { user, isVip, isAdmin, isGuest, promptGuest } = useAuth()
  const [comments, setComments] = useState([])
  const [likes,    setLikes]    = useState([])
  const [text,     setText]     = useState('')
  const [gifUrl,   setGifUrl]   = useState('')
  const [showGif,  setShowGif]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [liked,    setLiked]    = useState(false)
  const textRef = useRef()

  useEffect(() => {
    loadData()
  }, [animeId, ep])

  useEffect(() => {
    if (user) setLiked(likes.some(l => l.user_id === user.id))
  }, [likes, user])

  const loadData = async () => {
    setLoading(true)
    const [cmts, lks] = await Promise.allSettled([
      getComments(animeId, ep),
      getLikes(animeId, ep),
    ])
    setComments(cmts.status === 'fulfilled' ? cmts.value || [] : [])
    setLikes(lks.status === 'fulfilled' ? lks.value || [] : [])
    setLoading(false)
  }

  const handleLike = async () => {
    if (!user) { promptGuest(); return }
    if (liked) {
      await removeLike(animeId, ep, user.id)
      setLikes(l => l.filter(x => x.user_id !== user.id))
    } else {
      await addLike(animeId, ep, user.id)
      setLikes(l => [...l, { user_id: user.id }])
    }
    setLiked(v => !v)
  }

  const handleSend = async () => {
    if (!user) { promptGuest(); return }
    if (!text.trim() && !gifUrl) return
    if (sending) return
    setSending(true)
    try {
      const comment = await addComment({
        anime_id: animeId,
        ep,
        user_id:  user.id,
        name:     user.name,
        avatar:   user.avatar || user.picture || '',
        text:     text.trim().slice(0, 500),
        gif_url:  gifUrl,
        is_vip:   isVip,
        is_admin: isAdmin,
      })
      if (comment) {
        setComments(c => [comment, ...c])
        setText('')
        setGifUrl('')
        setShowGif(false)
      }
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id, userId) => {
    await deleteComment(id, isAdmin ? userId : user?.id)
    setComments(c => c.filter(x => x.id !== id))
  }

  return (
    <div className="comments-wrap">
      {/* Likes do episódio */}
      <div className="ep-likes">
        <button className={`ep-like-btn ${liked ? 'active' : ''}`} onClick={handleLike}>
          {liked ? '❤️' : '🤍'} {likes.length > 0 && <span>{likes.length}</span>}
        </button>
        <span className="ep-likes-label">curtidas neste episódio</span>
      </div>

      {/* Input de comentário */}
      <div className="cmnt-input-wrap">
        {user ? (
          <>
            {user.avatar || user.picture
              ? <img src={user.avatar || user.picture} className="cmnt-input-avatar" alt={user.name} />
              : <div className="cmnt-input-avatar cmnt-avatar-default">{user.name[0]?.toUpperCase()}</div>
            }
          </>
        ) : (
          <div className="cmnt-input-avatar cmnt-avatar-default">?</div>
        )}
        <div className="cmnt-input-box">
          <textarea
            ref={textRef}
            className="cmnt-textarea"
            placeholder={user ? 'Escreva um comentário...' : 'Entre para comentar...'}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={2}
            maxLength={500}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend() }}
          />
          {gifUrl && (
            <div className="cmnt-gif-preview">
              <img src={gifUrl} alt="gif selecionado" />
              <button onClick={() => setGifUrl('')}>✕</button>
            </div>
          )}
          <div className="cmnt-input-actions">
            <div className="cmnt-input-left">
              {(isVip || isAdmin) && (
                <button
                  className={`cmnt-gif-btn ${showGif ? 'active' : ''}`}
                  onClick={() => setShowGif(v => !v)}
                  title="Adicionar GIF (VIP)"
                >🎭 GIF</button>
              )}
              {!user && (
                <button className="cmnt-login-hint" onClick={promptGuest}>
                  👤 Entrar para comentar
                </button>
              )}
            </div>
            <button
              className="cmnt-send-btn"
              onClick={handleSend}
              disabled={sending || (!text.trim() && !gifUrl)}
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
          {showGif && (
            <GifPicker
              onSelect={url => { setGifUrl(url); setShowGif(false) }}
              onClose={() => setShowGif(false)}
            />
          )}
        </div>
      </div>

      {/* Lista de comentários */}
      <div className="cmnt-list">
        {loading
          ? Array(3).fill(0).map((_, i) => <div key={i} className="cmnt-skeleton" />)
          : comments.length === 0
            ? <p className="cmnt-empty">Seja o primeiro a comentar!</p>
            : comments.map(c => (
                <CommentItem
                  key={c.id}
                  c={c}
                  currentUserId={user?.id}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                />
              ))
        }
      </div>
    </div>
  )
}
