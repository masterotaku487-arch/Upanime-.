// src/data/animeOverrides.js
//
// Correção manual de dados errados vindos da AniList, pra casos específicos
// onde a base deles está com informação trocada/desatualizada.
//
// Como usar: adicione uma entrada usando o mal_id (o número que aparece na
// URL, tipo /anime/61316) como chave. Só precisa colocar os campos que
// estão ERRADOS — os outros continuam vindo normalmente da AniList.
//
// Campos disponíveis pra sobrescrever (todos opcionais):
//   title, title_english, title_japanese, synopsis, episodes,
//   image (capa), season, year, aired: { from, to }, status
//
// Campo especial (não altera o que aparece na tela):
//   search_name — nome EXATO usado pra buscar o anime nas APIs de
//   streaming (Shinokai/AnimeFire). Quando existe, é tentado primeiro.
//
// Exemplo:
// 61316: {
//   title: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
//   synopsis: '...',
//   episodes: 25,
// },

export const ANIME_OVERRIDES = {
  // Tensei Shitara Slime Datta Ken (1ª temporada)
  37430: {
    search_name: 'Tensei Shitara Slime Datta Ken',
  },

  61316: {
    title: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
    title_english: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
    // synopsis: '',   // ainda não informado
    // episodes: null, // ainda não informado
    // image: '',
  },

  // Jujutsu Kaisen (1ª temporada)
  40748: {
    title: 'Jujutsu Kaisen',
    title_english: 'Jujutsu Kaisen',
    search_name: 'Jujutsu Kaisen',
  },

  // Black Clover 2nd Season (em exibição — MAL retorna Episodes: Unknown)
  61967: {
    status: 'Currently Airing',
    episodes: 26,
  },
}

/** Nome a usar na busca das APIs de streaming (ou null se não houver) */
export function getSearchName(malId) {
  return ANIME_OVERRIDES[Number(malId)]?.search_name || null
}

/** Total de episódios corrigido manualmente (ou undefined se não houver) */
export function getEpisodesOverride(malId) {
  return ANIME_OVERRIDES[Number(malId)]?.episodes
}

/** Aplica a correção manual (se existir) por cima dos dados vindos da API */
export function applyAnimeOverride(animeData) {
  if (!animeData) return animeData
  const override = ANIME_OVERRIDES[animeData.mal_id]
  if (!override) return animeData

  return {
    ...animeData,
    ...(override.title          !== undefined && { title: override.title }),
    ...(override.title_english  !== undefined && { title_english: override.title_english }),
    ...(override.title_japanese !== undefined && { title_japanese: override.title_japanese }),
    ...(override.synopsis       !== undefined && { synopsis: override.synopsis }),
    ...(override.episodes       !== undefined && { episodes: override.episodes }),
    ...(override.season         !== undefined && { season: override.season }),
    ...(override.year           !== undefined && { year: override.year }),
    ...(override.status         !== undefined && { status: override.status }),
    ...(override.aired          !== undefined && { aired: { ...animeData.aired, ...override.aired } }),
    ...(override.image !== undefined && {
      images: {
        jpg: {
          image_url: override.image,
          large_image_url: override.image,
        },
      },
    }),
  }
}
