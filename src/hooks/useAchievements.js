// src/hooks/useAchievements.js
// Sincroniza conquistas local → Supabase quando usuário está logado
import { useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAchievements, saveAchievements } from '../services/supabase'

const LOCAL_KEY = 'upanime_achievements'

export const ACHIEVEMENTS = {
  first_watch:   { icon: '🎬', name: 'Primeira Vez',  desc: 'Assistiu o primeiro episódio' },
  binge_5:       { icon: '🍿', name: 'Maratonista',   desc: 'Assistiu 5 eps em um dia'     },
  binge_10:      { icon: '🔥', name: 'Viciado',       desc: 'Assistiu 10 eps em um dia'    },
  comment_first: { icon: '💬', name: 'Comentarista',  desc: 'Fez o primeiro comentário'    },
  fav_10:        { icon: '⭐', name: 'Colecionador',  desc: '10 animes nos favoritos'      },
  watch_50:      { icon: '🏅', name: 'Cinéfilo',      desc: '50 episódios assistidos'      },
  watch_100:     { icon: '🏆', name: 'Lendário',      desc: '100 episódios assistidos'     },
  vip:           { icon: '💎', name: 'VIP',           desc: 'Convidou 10 amigos'           },
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') }
  catch { return {} }
}

function saveLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
}

export function useAchievements() {
  const { user, isGuest } = useAuth()

  // Sincroniza do Supabase para local ao fazer login
  useEffect(() => {
    if (!user || isGuest) return
    syncFromSupabase()
  }, [user?.id])

  const syncFromSupabase = async () => {
    try {
      const remote = await getAchievements(user.id)
      if (remote) {
        const local = loadLocal()
        // Merge: une conquistas local + remoto
        const merged = {
          unlocked: Array.from(new Set([...(local.unlocked || []), ...(remote.unlocked || [])])),
          stats: { ...(local.stats || {}), ...(remote.stats || {}) },
        }
        saveLocal(merged)
        await saveAchievements(user.id, merged.unlocked, merged.stats)
      } else {
        // Primeira vez: sobe o que tem local
        const local = loadLocal()
        if (local.unlocked?.length > 0) {
          await saveAchievements(user.id, local.unlocked, local.stats || {})
        }
      }
    } catch (e) {
      console.warn('[Achievements] sync error:', e.message)
    }
  }

  const unlock = useCallback(async (id) => {
    const local = loadLocal()
    if ((local.unlocked || []).includes(id)) return false // já tem

    const unlocked = [...(local.unlocked || []), id]
    const updated  = { ...local, unlocked }
    saveLocal(updated)

    if (user && !isGuest) {
      try { await saveAchievements(user.id, unlocked, updated.stats || {}) }
      catch {}
    }

    return true // desbloqueou agora → pode mostrar notificação
  }, [user, isGuest])

  const updateStats = useCallback(async (key, value) => {
    const local   = loadLocal()
    const stats   = { ...(local.stats || {}), [key]: value }
    const updated = { ...local, stats }
    saveLocal(updated)

    if (user && !isGuest) {
      try { await saveAchievements(user.id, updated.unlocked || [], stats) }
      catch {}
    }
  }, [user, isGuest])

  const getStats = () => loadLocal().stats || {}
  const getUnlocked = () => loadLocal().unlocked || []

  // Verifica conquistas baseadas em stats
  const checkStats = useCallback(async () => {
    const stats    = getStats()
    const unlocked = getUnlocked()
    const toUnlock = []

    if ((stats.totalWatched || 0) >= 1   && !unlocked.includes('first_watch')) toUnlock.push('first_watch')
    if ((stats.todayWatched || 0) >= 5   && !unlocked.includes('binge_5'))     toUnlock.push('binge_5')
    if ((stats.todayWatched || 0) >= 10  && !unlocked.includes('binge_10'))    toUnlock.push('binge_10')
    if ((stats.totalWatched || 0) >= 50  && !unlocked.includes('watch_50'))    toUnlock.push('watch_50')
    if ((stats.totalWatched || 0) >= 100 && !unlocked.includes('watch_100'))   toUnlock.push('watch_100')
    if ((stats.totalFavs    || 0) >= 10  && !unlocked.includes('fav_10'))      toUnlock.push('fav_10')
    if ((stats.totalComments|| 0) >= 1   && !unlocked.includes('comment_first')) toUnlock.push('comment_first')

    for (const id of toUnlock) await unlock(id)
    return toUnlock
  }, [unlock])

  return { unlock, updateStats, getStats, getUnlocked, checkStats, ACHIEVEMENTS }
}
