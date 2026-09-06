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
// Exemplo:
// 61316: {
//   title: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
//   synopsis: '...',
//   episodes: 25,
// },

export const ANIME_OVERRIDES = {
  61316: {
    title: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
    title_english: 'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
    // synopsis: '',   // ainda não informado
    // episodes: null, // ainda não informado
    // image: '',
  },
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
