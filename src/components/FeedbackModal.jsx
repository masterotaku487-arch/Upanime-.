import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiAlertTriangle, FiMessageSquare, FiX, FiSend, FiCheck } from 'react-icons/fi'
import './FeedbackModal.css'

// Cole aqui o ID do seu form no formspree.io (ex: xpzvkqaw)
const FORMSPREE_ID = 'xyknzpwr'
const FORMSPREE_URL = `https://formspree.io/f/${FORMSPREE_ID}`

const BUG_OPTIONS = [
  { id: 'no_video',     icon: '📺', label: 'Vídeo não carregou' },
  { id: 'bad_quality',  icon: '🔴', label: 'Qualidade ruim / travando' },
  { id: 'wrong_ep',     icon: '🔀', label: 'Episódio errado' },
  { id: 'no_sound',     icon: '🔇', label: 'Sem áudio' },
  { id: 'no_sub',       icon: '🈳', label: 'Sem legenda/dublagem' },
  { id: 'app_crash',    icon: '💥', label: 'App travou / erro na tela' },
  { id: 'search',       icon: '🔍', label: 'Busca não encontrou anime' },
  { id: 'other',        icon: '🐛', label: 'Outro problema' },
]

export default function FeedbackModal({ onClose, animeId, ep, animeTitle }) {
  const { user } = useAuth()
  const [tab,       setTab]      = useState('bug')  // 'bug' | 'feedback'
  const [bugs,      setBugs]     = useState([])
  const [note,      setNote]     = useState('')
  const [rating,    setRating]   = useState(0)
  const [feedText,  setFeedText] = useState('')
  const [sending,   setSending]  = useState(false)
  const [done,      setDone]     = useState(false)

  const toggleBug = (id) =>
    setBugs(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])

  const handleSend = async () => {
    if (tab === 'bug' && bugs.length === 0) return
    if (tab === 'feedback' && rating === 0) return
    setSending(true)
    try {
      const bugsLabel = bugs.map(id => BUG_OPTIONS.find(b => b.id === id)?.label || id).join(', ')

      const formData = tab === 'bug'
        ? {
            _subject:   `🐛 Bug: ${animeTitle || 'Geral'} EP${ep || '?'}`,
            tipo:       'Bug Report',
            problemas:  bugsLabel,
            detalhes:   note.trim() || '—',
            anime:      animeTitle  || '—',
            episodio:   ep          || '—',
            url:        window.location.href,
            usuario:    user ? `${user.name} (${user.id})` : 'Visitante',
          }
        : {
            _subject:   `💬 Feedback — ${rating}⭐`,
            tipo:       'Feedback',
            nota:       `${'⭐'.repeat(rating)} (${rating}/5)`,
            mensagem:   feedText.trim() || '—',
            usuario:    user ? `${user.name} (${user.id})` : 'Visitante',
          }

      await fetch(FORMSPREE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(formData),
      })
      setDone(true)
    } catch {}
    finally { setSending(false) }
  }

  if (done) {
    return (
      <div className="feedback-overlay" onClick={onClose}>
        <div className="feedback-modal" onClick={e => e.stopPropagation()}>
          <div className="feedback-done">
            <div className="feedback-done-icon"><FiCheck size={32} /></div>
            <h3>{tab === 'bug' ? 'Bug reportado!' : 'Obrigado pelo feedback!'}</h3>
            <p>{tab === 'bug'
              ? 'Vamos verificar e corrigir em breve 🔧'
              : 'Sua opinião ajuda a melhorar o Up Anime+ 💙'}
            </p>
            <button className="feedback-close-btn" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={e => e.stopPropagation()}>
        <div className="feedback-header">
          <div className="feedback-tabs">
            <button className={tab === 'bug' ? 'active' : ''} onClick={() => setTab('bug')}>
              <FiAlertTriangle /> Relatar Bug
            </button>
            <button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>
              <FiMessageSquare /> Feedback
            </button>
          </div>
          <button className="feedback-x" onClick={onClose}><FiX /></button>
        </div>

        {tab === 'bug' ? (
          <>
            <p className="feedback-hint">
              {animeTitle ? `🎌 ${animeTitle} — EP ${ep}` : 'Selecione o(s) problema(s):'}
            </p>
            <div className="bug-grid">
              {BUG_OPTIONS.map(b => (
                <button
                  key={b.id}
                  className={`bug-option ${bugs.includes(b.id) ? 'selected' : ''}`}
                  onClick={() => toggleBug(b.id)}
                >
                  <span>{b.icon}</span>
                  <span>{b.label}</span>
                  {bugs.includes(b.id) && <span className="bug-check">✓</span>}
                </button>
              ))}
            </div>
            <textarea
              className="feedback-textarea"
              placeholder="Detalhes adicionais (opcional)..."
              maxLength={300}
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </>
        ) : (
          <>
            <p className="feedback-hint">Como você avalia o Up Anime+?</p>
            <div className="star-rating">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  className={`star ${n <= rating ? 'lit' : ''}`}
                  onClick={() => setRating(n)}
                >★</button>
              ))}
              <span className="star-label">
                {rating === 0 ? '' : ['', 'Ruim', 'Regular', 'Bom', 'Ótimo', 'Incrível!'][rating]}
              </span>
            </div>
            <textarea
              className="feedback-textarea"
              placeholder="O que você gostou? O que pode melhorar? (opcional)"
              maxLength={500}
              rows={3}
              value={feedText}
              onChange={e => setFeedText(e.target.value)}
            />
          </>
        )}

        <button
          className="feedback-send-btn"
          onClick={handleSend}
          disabled={sending || (tab === 'bug' && bugs.length === 0) || (tab === 'feedback' && rating === 0)}
        >
          <FiSend /> {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
