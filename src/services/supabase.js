// src/services/supabase.js
const SUPABASE_URL = 'https://umpukpyfwfqdkurrlojn.supabase.co'
const SUPABASE_ANON = 'sb_publishable_DXd5goRi1Vl3PcKp1EMbbw_q50v-lTK'

const headers = (extra = {}) => ({
  'apikey': SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
  ...extra,
})

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: headers(opts.headers),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfile(id) {
  const data = await sbFetch(`profiles?id=eq.${encodeURIComponent(id)}&limit=1`)
  return data?.[0] || null
}

export async function upsertProfile(profile) {
  return sbFetch('profiles', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ ...profile, updated_at: new Date().toISOString() }),
  })
}

export async function updateProfile(id, updates) {
  return sbFetch(`profiles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  })
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function getComments(animeId, ep) {
  return sbFetch(
    `comments?anime_id=eq.${animeId}&ep=eq.${ep}&order=created_at.desc&limit=100`
  )
}

export async function addComment(comment) {
  const data = await sbFetch('comments', {
    method: 'POST',
    body: JSON.stringify(comment),
  })
  return data?.[0]
}

export async function deleteComment(id, userId) {
  return sbFetch(`comments?id=eq.${id}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

// ── Likes ─────────────────────────────────────────────────────────────────────

export async function getLikes(animeId, ep) {
  const data = await sbFetch(
    `likes?anime_id=eq.${animeId}&ep=eq.${ep}&select=user_id`
  )
  return data || []
}

export async function addLike(animeId, ep, userId) {
  return sbFetch('likes', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ anime_id: animeId, ep, user_id: userId }),
  })
}

export async function removeLike(animeId, ep, userId) {
  return sbFetch(
    `likes?anime_id=eq.${animeId}&ep=eq.${ep}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
}

// ── Watch History ─────────────────────────────────────────────────────────────

export async function addWatchHistory(userId, animeId, animeTitle, animeImage, ep) {
  return sbFetch('watch_history', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      anime_id: animeId,
      anime_title: animeTitle,
      anime_image: animeImage,
      ep,
      watched_at: new Date().toISOString(),
    }),
  })
}

export async function getWatchHistory(userId, limit = 20) {
  return sbFetch(
    `watch_history?user_id=eq.${encodeURIComponent(userId)}&order=watched_at.desc&limit=${limit}`
  )
}

// ── Achievements ──────────────────────────────────────────────────────────────

export async function getAchievements(userId) {
  const data = await sbFetch(`achievements?user_id=eq.${encodeURIComponent(userId)}&limit=1`)
  return data?.[0] || null
}

export async function saveAchievements(userId, unlocked, stats) {
  return sbFetch('achievements', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      unlocked,
      stats,
      updated_at: new Date().toISOString(),
    }),
  })
}

// ── Favorites ─────────────────────────────────────────────────────────────────

export async function getFavorites(userId) {
  return sbFetch(`favorites?user_id=eq.${encodeURIComponent(userId)}&order=added_at.desc`)
}

export async function addFavorite(userId, animeId, animeTitle, animeImage) {
  return sbFetch('favorites', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, anime_id: animeId, anime_title: animeTitle, anime_image: animeImage }),
  })
}

export async function removeFavorite(userId, animeId) {
  return sbFetch(
    `favorites?user_id=eq.${encodeURIComponent(userId)}&anime_id=eq.${animeId}`,
    { method: 'DELETE' }
  )
}

// ── Anime Views ───────────────────────────────────────────────────────────────

export async function incrementAnimeViews(animeId, animeTitle, animeImage) {
  return sbFetch('rpc/increment_anime_views', {
    method: 'POST',
    body: JSON.stringify({ p_anime_id: animeId, p_anime_title: animeTitle, p_anime_image: animeImage }),
  })
}

export async function getTopAnimeViews(limit = 10) {
  return sbFetch(`anime_views?order=views.desc&limit=${limit}`)
}

// ── Ranking ───────────────────────────────────────────────────────────────────

export async function getTopUsers(limit = 10) {
  // Top usuários por episódios assistidos
  return sbFetch(
    `watch_history?select=user_id,count&group=user_id&order=count.desc&limit=${limit}`
  )
}

export async function getUserPublicProfile(userId) {
  const [profile, achievements, favorites] = await Promise.allSettled([
    getProfile(userId),
    getAchievements(userId),
    sbFetch(`favorites?user_id=eq.${encodeURIComponent(userId)}&order=added_at.desc&limit=6`),
  ])
  return {
    profile: profile.status === 'fulfilled' ? profile.value : null,
    achievements: achievements.status === 'fulfilled' ? achievements.value : null,
    favorites: favorites.status === 'fulfilled' ? favorites.value : [],
  }
}

// ── Referrals (VIP) ───────────────────────────────────────────────────────────

export async function getReferralCount(referrerId) {
  const data = await sbFetch(
    `referrals?referrer_id=eq.${encodeURIComponent(referrerId)}&select=id`
  )
  return data?.length || 0
}

export async function registerReferral(referrerId, visitorIp) {
  try {
    await sbFetch('referrals', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ referrer_id: referrerId, visitor_ip: visitorIp }),
    })
    const count = await getReferralCount(referrerId)
    // Se atingiu 10 convites únicos → promove VIP
    if (count >= 10) {
      await updateProfile(referrerId, {
        is_vip: true,
        vip_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 dias
      })
    }
    return count
  } catch { return 0 }
}
