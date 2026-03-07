import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiAward, FiTrendingUp } from 'react-icons/fi'
import { ACHIEVEMENTS, loadAchievements, loadStats, getProgress } from '../services/achievements'
import './AchievementsPage.css'

const CATEGORIES = [
  { id: 'all',     label: '🏆 Todas'    },
  { id: 'eps',     label: '📺 Episódios' },
  { id: 'streak',  label: '🔥 Streak'   },
  { id: 'genre',   label: '🎭 Gêneros'  },
  { id: 'complete',label: '🏁 Completos'},
  { id: 'special', label: '🌙 Especiais' },
  { id: 'rare',    label: '👑 Raras'    },
]

function AchCard({ achievement, unlocked, stats }) {
  const prog = getProgress(achievement, stats)
  const pct  = prog ? Math.min(100, Math.round((prog.current / prog.max) * 100)) : null
  const done = unlocked.includes(achievement.id)

  return (
    <div className={`ach-card ${done ? 'done' : 'locked'} ${achievement.rare ? 'rare' : ''}`}>
      <div className="ach-icon">{achievement.icon}</div>
      <div className="ach-info">
        <span className="ach-title">{achievement.title}</span>
        <span className="ach-desc">{achievement.desc}</span>
        {prog && !done && (
          <div className="ach-prog">
            <div className="ach-prog-bar" style={{ width: `${pct}%` }} />
            <span className="ach-prog-label">{prog.current} / {prog.max}</span>
          </div>
        )}
        {done && <span className="ach-done-label">✓ Desbloqueada</span>}
      </div>
      {achievement.rare && <span className="ach-rare-badge">RARA</span>}
    </div>
  )
}

export default function AchievementsPage() {
  const [tab,       setTab]       = useState('all')
  const [view,      setView]      = useState('achievements') // 'achievements' | 'ranking'
  const [achData,   setAchData]   = useState({ unlocked: [] })
  const [stats,     setStats]     = useState(null)

  useEffect(() => {
    setAchData(loadAchievements())
    setStats(loadStats())
  }, [])

  const filtered = ACHIEVEMENTS.filter(a => {
    if (tab === 'all')    return true
    if (tab === 'rare')   return a.rare
    if (tab === 'special')return a.type === 'special'
    return a.type === tab || (tab === 'complete' && a.type === 'animes')
  })

  const unlocked = achData.unlocked || []
  const total    = ACHIEVEMENTS.length
  const done     = unlocked.length

  // Ranking simulado baseado nos stats locais
  const rankingData = stats ? [
    { label: 'Episódios Assistidos', value: stats.totalEps,        icon: '📺', rank: '—' },
    { label: 'Animes Únicos',        value: stats.totalAnimes,     icon: '🎌', rank: '—' },
    { label: 'Animes Completos',     value: stats.completedAnimes, icon: '🏁', rank: '—' },
    { label: 'Maior Streak',         value: `${stats.streak.count} dias`, icon: '🔥', rank: '—' },
    { label: 'Dias no Site',         value: stats.daysUsed.length, icon: '📅', rank: '—' },
    { label: 'Conquistas',           value: `${done}/${total}`,    icon: '🏆', rank: '—' },
  ] : []

  return (
    <div className="ach-page container">
      <div className="ach-header">
        <Link to="/config" className="back-btn"><FiArrowLeft /> Voltar</Link>
        <div>
          <h1 className="ach-title-main">Conquistas</h1>
          <p className="ach-subtitle">{done} de {total} desbloqueadas</p>
        </div>
        <div className="ach-header-tabs">
          <button className={view === 'achievements' ? 'active' : ''} onClick={() => setView('achievements')}>
            <FiAward /> Conquistas
          </button>
          <button className={view === 'ranking' ? 'active' : ''} onClick={() => setView('ranking')}>
            <FiTrendingUp /> Meu Ranking
          </button>
        </div>
      </div>

      {/* Barra de progresso geral */}
      <div className="ach-overall">
        <div className="ach-overall-bar">
          <div className="ach-overall-fill" style={{ width: `${(done/total)*100}%` }} />
        </div>
        <span>{Math.round((done/total)*100)}% completo</span>
      </div>

      {view === 'achievements' ? (
        <>
          {/* Filtros de categoria */}
          <div className="ach-cats">
            {CATEGORIES.map(c => (
              <button key={c.id} className={`ach-cat ${tab === c.id ? 'active' : ''}`} onClick={() => setTab(c.id)}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Grid de conquistas */}
          <div className="ach-grid">
            {/* Desbloqueadas primeiro */}
            {filtered.filter(a => unlocked.includes(a.id)).map(a => (
              <AchCard key={a.id} achievement={a} unlocked={unlocked} stats={stats} />
            ))}
            {/* Depois bloqueadas */}
            {filtered.filter(a => !unlocked.includes(a.id)).map(a => (
              <AchCard key={a.id} achievement={a} unlocked={unlocked} stats={stats} />
            ))}
          </div>
        </>
      ) : (
        <div className="ranking-list">
          <p className="ranking-note">📊 Suas estatísticas pessoais</p>
          {rankingData.map((r, i) => (
            <div key={i} className="ranking-item">
              <span className="ranking-icon">{r.icon}</span>
              <span className="ranking-label">{r.label}</span>
              <span className="ranking-value">{r.value}</span>
            </div>
          ))}

          {stats && (
            <div className="ranking-genres">
              <h3>🎭 Gêneros Assistidos</h3>
              <div className="genre-bars">
                {Object.entries(stats.genreCount || {})
                  .sort((a,b) => b[1]-a[1])
                  .slice(0,8)
                  .map(([genre, count]) => (
                    <div key={genre} className="genre-bar-row">
                      <span className="genre-bar-name">{genre}</span>
                      <div className="genre-bar-bg">
                        <div className="genre-bar-fill" style={{ width: `${Math.min(100, count*10)}%` }} />
                      </div>
                      <span className="genre-bar-count">{count}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
