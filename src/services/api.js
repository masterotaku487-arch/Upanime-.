// src/services/api.js

const JIKAN_BASE = "https://api.jikan.moe/v4";
const CONSUMET_BASE = "https://api.consumet.org";

// ===============================
// 🔥 TEMPORADA ATUAL
// ===============================
export async function getSeasonNow() {
  try {
    const res = await fetch(`${JIKAN_BASE}/seasons/now`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro getSeasonNow:", err);
    return [];
  }
}

// ===============================
// ⭐ TOP ANIMES
// ===============================
export async function getTopAnime() {
  try {
    const res = await fetch(`${JIKAN_BASE}/top/anime`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro getTopAnime:", err);
    return [];
  }
}

// ===============================
// 🚀 PRÓXIMA TEMPORADA
// ===============================
export async function getSeasonUpcoming() {
  try {
    const res = await fetch(`${JIKAN_BASE}/seasons/upcoming`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro getSeasonUpcoming:", err);
    return [];
  }
}

// ===============================
// 🔍 BUSCAR ANIME
// ===============================
export async function searchAnime(query) {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime?q=${query}&limit=12`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro searchAnime:", err);
    return [];
  }
}

// ===============================
// 📖 DETALHES (principal)
// ===============================
export async function getAnimeDetails(id) {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime/${id}/full`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error("Erro getAnimeDetails:", err);
    return null;
  }
}

// ===============================
// 📖 COMPATIBILIDADE
// ===============================
export async function getAnimeById(id) {
  return await getAnimeDetails(id);
}
// ===============================
// 🎭 ANIMES POR GÊNERO
// ===============================
export async function getAnimeByGenre(genreId) {
  try {
    const res = await fetch(
      `${JIKAN_BASE}/anime?genres=${genreId}&order_by=score&sort=desc`
    );
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro getAnimeByGenre:", err);
    return [];
  }
}
// ===============================
// 📚 LISTAR GÊNEROS
// ===============================
export async function getGenres() {
  try {
    const res = await fetch(`${JIKAN_BASE}/genres/anime`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro getGenres:", err);
    return [];
  }
}
// ===============================
// 🎬 EPISÓDIOS POR TÍTULO
// ===============================
export async function getEpisodes(title) {
  try {
    const res = await fetch(
      `${CONSUMET_BASE}/anime/gogoanime/${encodeURIComponent(title)}`
    );
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      return [];
    }

    const animeId = data.results[0].id;

    const epRes = await fetch(
      `${CONSUMET_BASE}/anime/gogoanime/info/${animeId}`
    );
    const epData = await epRes.json();

    return epData.episodes || [];
  } catch (err) {
    console.error("Erro getEpisodes:", err);
    return [];
  }
}

// ===============================
// 🎬 COMPATIBILIDADE
// ===============================
export async function getAnimeEpisodes(title) {
  return await getEpisodes(title);
}

// ===============================
// ▶️ STREAM
// ===============================
export async function getStreamingLink(episodeId) {
  try {
    const res = await fetch(
      `${CONSUMET_BASE}/anime/gogoanime/watch/${episodeId}`
    );
    const data = await res.json();

    if (data.sources && data.sources.length > 0) {
      return data.sources[0].url;
    }

    return null;
  } catch (err) {
    console.error("Erro getStreamingLink:", err);
    return null;
  }
      }
