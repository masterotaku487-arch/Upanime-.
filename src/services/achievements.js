// src/services/achievements.js — Sistema de conquistas do Up Anime+

const KEY_STATS        = 'upanime_stats'
const KEY_ACHIEVEMENTS = 'upanime_achievements'

// ─── Definição de todas as conquistas ──────────────────────────────────────
export const ACHIEVEMENTS = [
  // Episódios assistidos
  { id: 'first_ep',       icon: '🎬', title: 'Primeiro Episódio',   desc: 'Assistiu seu 1º episódio',          type: 'eps',     value: 1    },
  { id: 'eps_10',         icon: '📺', title: 'Viciado em Anime',    desc: '10 episódios assistidos',            type: 'eps',     value: 10   },
  { id: 'eps_50',         icon: '🍿', title: 'Maratonista',         desc: '50 episódios assistidos',            type: 'eps',     value: 50   },
  { id: 'eps_100',        icon: '🔥', title: 'Otaku Hardcore',      desc: '100 episódios assistidos',           type: 'eps',     value: 100  },
  { id: 'eps_500',        icon: '👑', title: 'Mestre Otaku',        desc: '500 episódios assistidos',           type: 'eps',     value: 500  },
  { id: 'eps_1000',       icon: '👑', title: 'Rei do Anime',        desc: '1000 episódios assistidos',          type: 'eps',     value: 1000, rare: true },

  // Streak
  { id: 'streak_2',       icon: '🌱', title: 'Começando',           desc: '2 dias seguidos',                   type: 'streak',  value: 2    },
  { id: 'streak_7',       icon: '🔥', title: 'Fã Dedicado',         desc: '7 dias seguidos',                   type: 'streak',  value: 7    },
  { id: 'streak_14',      icon: '⚡', title: 'Sem Dormir',          desc: '14 dias seguidos',                  type: 'streak',  value: 14   },
  { id: 'streak_30',      icon: '🏯', title: 'Lenda Otaku',         desc: '30 dias seguidos',                  type: 'streak',  value: 30   },

  // Gêneros
  { id: 'genre_shounen',  icon: '⚔️', title: 'Guerreiro Shounen',   desc: '10 animes shounen assistidos',      type: 'genre',   genre: 'Shounen', value: 10 },
  { id: 'genre_romance',  icon: '💕', title: 'Coração de Romance',  desc: '10 animes romance assistidos',      type: 'genre',   genre: 'Romance', value: 10 },
  { id: 'genre_isekai',   icon: '🧙', title: 'Fã de Isekai',        desc: '10 animes isekai assistidos',       type: 'genre',   genre: 'Isekai',  value: 10 },
  { id: 'genre_horror',   icon: '👻', title: 'Caçador de Terror',   desc: '10 animes de terror assistidos',    type: 'genre',   genre: 'Horror',  value: 10 },
  { id: 'genre_mecha',    icon: '🤖', title: 'Piloto de Mecha',     desc: '5 animes mecha assistidos',         type: 'genre',   genre: 'Mecha',   value: 5  },

  // Animes completos
  { id: 'complete_1',     icon: '🏁', title: 'Terminou a Jornada',  desc: 'Completou 1 anime',                 type: 'complete', value: 1   },
  { id: 'complete_5',     icon: '📚', title: 'Maratonista de Temporada', desc: 'Completou 5 animes',            type: 'complete', value: 5   },
  { id: 'complete_10',    icon: '🎬', title: 'Colecionador',        desc: 'Completou 10 animes',               type: 'complete', value: 10  },
  { id: 'complete_100',   icon: '📺', title: 'Enciclopédia Otaku',  desc: 'Assistiu 100 animes diferentes',    type: 'animes',   value: 100, rare: true },

  // Especiais
  { id: 'night_owl',      icon: '🌙', title: 'Coruja Otaku',        desc: 'Assistiu depois das 2h da manhã',   type: 'special'  },
  { id: 'early_bird',     icon: '☀️', title: 'Madrugador',          desc: 'Assistiu antes das 7h',             type: 'special'  },
  { id: 'sunday_marathon',icon: '🍜', title: 'Maratona de Domingo', desc: '5 eps no mesmo dia',                type: 'special'  },

  // Raras
  { id: 'days_100',       icon: '🏆', title: 'Lenda do Up Anime+',  desc: 'Usou o site por 100 dias',          type: 'days',    value: 100, rare: true },
]

// ─── Carrega / salva stats ──────────────────────────────────────────────────
export const loadStats = () => {
  try {
    const d = localStorage.getItem(KEY_STATS)
    return d ? JSON.parse(d) : defaultStats()
  } catch { return defaultStats() }
}

const defaultStats = () => ({
  totalEps:       0,
  watchedEpIds:   {},   // "malId_ep" → true (evita duplicata)
  totalAnimes:    0,    // animes únicos com ≥1 ep assistido
  watchedAnimes:  {},   // malId → { eps: Set-like {}, total, genres[] }
  completedAnimes:0,
  genreCount:     {},   // gênero → qtd de animes únicos
  streak:         { lastDate: null, count: 0 },
  daysUsed:       [],   // datas únicas
  todayEps:       { date: null, count: 0 },
  firstUsedAt:    Date.now(),
})

const saveStats = (s) => {
  try { localStorage.setItem(KEY_STATS, JSON.stringify(s)) } catch {}
}

// ─── Carrega / salva conquistas desbloqueadas ───────────────────────────────
export const loadAchievements = () => {
  try {
    const d = localStorage.getItem(KEY_ACHIEVEMENTS)
    return d ? JSON.parse(d) : { unlocked: [], seenAt: {} }
  } catch { return { unlocked: [], seenAt: {} } }
}

const saveAchievements = (a) => {
  try { localStorage.setItem(KEY_ACHIEVEMENTS, JSON.stringify(a)) } catch {}
}

// ─── Verifica quais novas conquistas foram desbloqueadas ───────────────────
const checkConditions = (stats, unlocked) => {
  const newOnes = []
  for (const a of ACHIEVEMENTS) {
    if (unlocked.includes(a.id)) continue
    let met = false
    if (a.type === 'eps')     met = stats.totalEps >= a.value
    if (a.type === 'streak')  met = stats.streak.count >= a.value
    if (a.type === 'genre')   met = (stats.genreCount[a.genre] || 0) >= a.value
    if (a.type === 'complete')met = stats.completedAnimes >= a.value
    if (a.type === 'animes')  met = stats.totalAnimes >= a.value
    if (a.type === 'days')    met = stats.daysUsed.length >= a.value
    if (met) newOnes.push(a.id)
  }
  return newOnes
}

// ─── Função principal: chamada quando usuário assiste ≥75% de um episódio ──
export const recordWatched = ({ malId, ep, totalEps, genres = [] }) => {
  const stats = loadStats()
  const epKey = `${malId}_${ep}`
  const today = new Date().toISOString().slice(0, 10)
  const hour  = new Date().getHours()

  // Evita contar o mesmo ep duas vezes
  const alreadyCounted = !!stats.watchedEpIds[epKey]

  if (!alreadyCounted) {
    stats.watchedEpIds[epKey] = true
    stats.totalEps++

    // Anime novo?
    if (!stats.watchedAnimes[malId]) {
      stats.watchedAnimes[malId] = { eps: {}, total: totalEps || 0 }
      stats.totalAnimes++
      // Conta gêneros (1 por anime único por gênero)
      for (const g of genres) {
        stats.genreCount[g] = (stats.genreCount[g] || 0) + 1
      }
    }
    stats.watchedAnimes[malId].eps[ep] = true

    // Anime completo?
    const watched = Object.keys(stats.watchedAnimes[malId].eps).length
    const total   = stats.watchedAnimes[malId].total
    if (total > 0 && watched >= total && !stats.watchedAnimes[malId].completed) {
      stats.watchedAnimes[malId].completed = true
      stats.completedAnimes++
    }

    // Eps no mesmo dia
    if (stats.todayEps.date === today) {
      stats.todayEps.count++
    } else {
      stats.todayEps = { date: today, count: 1 }
    }
  }

  // Streak (conta independente de ep duplicado)
  if (!stats.daysUsed.includes(today)) {
    stats.daysUsed.push(today)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (stats.streak.lastDate === yesterday) {
      stats.streak.count++
    } else if (stats.streak.lastDate !== today) {
      stats.streak.count = 1
    }
    stats.streak.lastDate = today
  }

  // Conquistas especiais
  const achData   = loadAchievements()
  const unlocked  = [...achData.unlocked]
  const newNormal = checkConditions(stats, unlocked)
  const newSpecial = []

  if (!unlocked.includes('night_owl') && (hour >= 2 && hour < 5))
    newSpecial.push('night_owl')
  if (!unlocked.includes('early_bird') && hour < 7)
    newSpecial.push('early_bird')
  if (!unlocked.includes('sunday_marathon') && stats.todayEps.count >= 5)
    newSpecial.push('sunday_marathon')

  const allNew = [...newNormal, ...newSpecial]

  if (allNew.length) {
    const now = Date.now()
    allNew.forEach(id => {
      unlocked.push(id)
      achData.seenAt[id] = now
    })
    saveAchievements({ unlocked, seenAt: achData.seenAt })
  }

  saveStats(stats)
  return allNew.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
}

// ─── Progresso de cada conquista (para barra de progresso) ─────────────────
export const getProgress = (achievement, stats) => {
  const s = stats || loadStats()
  if (achievement.type === 'eps')     return { current: s.totalEps,        max: achievement.value }
  if (achievement.type === 'streak')  return { current: s.streak.count,    max: achievement.value }
  if (achievement.type === 'genre')   return { current: s.genreCount[achievement.genre] || 0, max: achievement.value }
  if (achievement.type === 'complete')return { current: s.completedAnimes, max: achievement.value }
  if (achievement.type === 'animes')  return { current: s.totalAnimes,     max: achievement.value }
  if (achievement.type === 'days')    return { current: s.daysUsed.length, max: achievement.value }
  return null
}
