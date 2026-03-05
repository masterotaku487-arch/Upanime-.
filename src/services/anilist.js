// AniList GraphQL API — leitura pública (sem auth)
// Só busca dados extras (trailer, score, relações) sem quebrar se falhar

const ANILIST = 'https://graphql.anilist.co'

const QUERY_BY_MAL = `
query ($malId: Int) {
  Media(idMal: $malId, type: ANIME) {
    id
    title { romaji english native }
    description
    averageScore
    popularity
    episodes
    status
    season
    seasonYear
    trailer { id site }
    coverImage { extraLarge large }
    bannerImage
    genres
    tags { name rank }
    relations {
      edges {
        relationType
        node { id idMal title { romaji english } coverImage { large } type }
      }
    }
    studios { nodes { name isAnimationStudio } }
    nextAiringEpisode { episode airingAt }
  }
}
`

export async function getAniListByMalId(malId) {
  try {
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY_BY_MAL, variables: { malId: parseInt(malId) } }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.Media || null
  } catch {
    return null // falha silenciosamente
  }
}

// Formata data de próximo episódio
export function formatNextEp(nextAiring) {
  if (!nextAiring) return null
  const date = new Date(nextAiring.airingAt * 1000)
  const now = new Date()
  const diff = Math.round((date - now) / 86400000)
  const formatted = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
  return {
    ep: nextAiring.episode,
    date: formatted,
    daysLeft: diff,
    label: diff === 0 ? 'Hoje!' : diff === 1 ? 'Amanhã' : `Em ${diff} dias`,
  }
}
