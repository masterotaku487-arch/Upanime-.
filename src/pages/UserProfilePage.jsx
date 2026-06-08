// src/pages/UserProfilePage.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getUserPublicProfile } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { useReferral } from '../hooks/useReferral'
import './UserProfilePage.css'

const ACHIEVEMENTS_DEF = [
  { id: 'first_watch',    icon: '🎬', name: 'Primeira Vez',    desc: 'Assistiu o primeiro episódio'  },
  { id: 'binge_5',        icon: '🍿', name: 'Maratonista',     desc: 'Assistiu 5 eps em um dia'      },
  { id: 'binge_10',       icon: '🔥', name: 'Viciado',         desc: 'Assistiu 10 eps em um dia'     },
  { id: 'comment_first',  icon: '💬', name: 'Comentarista',    desc: 'Fez o primeiro comentário'     },
  { id: 'fav_10',         icon: '⭐', name: 'Colecionador',    desc: '10 animes nos favoritos'       },
  { id: 'watch_50',       icon: '🏅', name: 'Cinéfilo',        desc: '50 episódios assistidos'       },
  { id: 'watch_100',      icon: '🏆', name: 'Lendário',        desc: '100 episódios assistidos'      },
  { id: 'vip',            icon: '💎', name: 'VIP',             desc: 'Convidou 10 amigos'            },
]

function AchievementBadge({ ach, unlocked }) {
  return (
    <div className={`ach-badge ${unlocked ? 'unlocked' : 'locked'}`} title={ach.desc}>
      <span className="ach-icon">{unlocked ? ach.icon : '🔒'}</span>
      <span className="ach-name">{ach.name}</span>
    </div>
  )
}

export default function UserProfilePage() {
  const { userId }  = useParams()
  const { user: me, isVip, isAdmin } = useAuth()
  const { getReferralLink, getMyReferralCount, VIP_THRESHOLD } = useReferral()

  const isOwnProfile = me?.id === userId || !userId

  const [profile,      setProfile]      = useState(null)
  const [achievements, setAchievements] = useState(null)
  const [favorites,    setFavorites]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [refLink,      setRefLink]      = useState('')
  const [refCount,     setRefCount]     = useState(0)
  const [copied,       setCopied]       = useState(false)

  const targetId = userId || me?.id

  useEffect(() => {
    if (!targetId) { setLoading(false); return }
    load()
  }, [targetId])

  useEffect(() => {
    if (isOwnProfile && me) {
      setRefLink(getReferralLink())
      getMyReferralCount().then(setRefCount)
    }
  }, [me])

  const load = async () => {
    setLoading(true)
    const { profile, achievements, favorites } = await getUserPublicProfile(targetId)
    setProfile(profile)
    setAchievements(achievements)
    setFavorites(favorites || [])
    setLoading(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!me && !userId) {
    return (
      <div className="upp-empty">
        <p>Faça login para ver seu perfil</p>
      </div>
    )
  }

  if (loading) return <div className="upp-loading">Carregando perfil...</div>
  if (!profile) return <div className="upp-empty">Perfil não encontrado</div>

  const unlockedIds = achievements?.unlocked || []

  return (
    <div className="upp-wrap">
      {/* Header do perfil */}
      <div className={`upp-header ${profile.is_admin ? 'upp-admin' : ''} ${profile.is_vip ? 'upp-vip' : ''}`}>
        <div className="upp-avatar-wrap">
          {profile.avatar
            ? <img src={profile.avatar} alt={profile.name} className="upp-avatar" />
            : <div className="upp-avatar upp-avatar-default">{profile.name[0]?.toUpperCase()}</div>
          }
          {profile.is_admin && <span className="upp-role-badge admin">⚡ ADM</span>}
          {profile.is_vip   && !profile.is_admin && <span className="upp-role-badge vip">💎 VIP</span>}
          {profile.is_guest && <span className="upp-role-badge guest">👤 Visitante</span>}
        </div>
        <div className="upp-info">
          <h1 className="upp-name">{profile.name}</h1>
          {profile.bio && <p className="upp-bio">{profile.bio}</p>}
          <span className="upp-since">Membro desde {new Date(profile.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* VIP — sistema de convites (só para o próprio perfil) */}
      {isOwnProfile && !isVip && !isAdmin && (
        <div className="upp-vip-card">
          <div className="upp-vip-header">
            <span>💎 Torne-se VIP</span>
            <span className="upp-vip-progress">{refCount}/{VIP_THRESHOLD} convidados</span>
          </div>
          <div className="upp-vip-bar">
            <div className="upp-vip-fill" style={{ width: `${Math.min(100, (refCount / VIP_THRESHOLD) * 100)}%` }} />
          </div>
          <p className="upp-vip-desc">Convide {VIP_THRESHOLD - refCount} amigos para ganhar VIP grátis por 90 dias!</p>
          {refLink && (
            <div className="upp-ref-row">
              <input readOnly value={refLink} className="upp-ref-input" />
              <button className="upp-ref-copy" onClick={copyLink}>
                {copied ? '✅' : '📋'} {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          )}
          <ul className="upp-vip-perks">
            <li>🎭 GIFs nos comentários</li>
            <li>💎 Badge VIP no perfil e comentários</li>
            <li>⭐ Destaque no ranking</li>
          </ul>
        </div>
      )}

      {isVip && isOwnProfile && (
        <div className="upp-vip-active">
          💎 Você é VIP! {profile.vip_until && (
            <span>Válido até {new Date(profile.vip_until).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      )}

      {/* Conquistas */}
      <div className="upp-section">
        <h2 className="upp-section-title">🏆 Conquistas</h2>
        <div className="upp-achievements">
          {ACHIEVEMENTS_DEF.map(a => (
            <AchievementBadge
              key={a.id}
              ach={a}
              unlocked={unlockedIds.includes(a.id)}
            />
          ))}
        </div>
      </div>

      {/* Favoritos (se público ou próprio perfil) */}
      {(profile.favorites_public || isOwnProfile) && favorites.length > 0 && (
        <div className="upp-section">
          <h2 className="upp-section-title">⭐ Favoritos</h2>
          <div className="upp-favorites">
            {favorites.map(f => (
              <Link key={f.anime_id} to={`/anime/${f.anime_id}`} className="upp-fav-item">
                {f.anime_image
                  ? <img src={f.anime_image} alt={f.anime_title} />
                  : <div className="upp-fav-placeholder">🎬</div>
                }
                <span className="upp-fav-title">{f.anime_title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
