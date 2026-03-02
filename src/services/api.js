// src/services/api.js

const JIKAN_BASE = "https://api.jikan.moe/v4";
const CONSUMET_BASE = "https://api.consumet.org";

// ===============================
// 🔥 Buscar animes (dados gerais)
// ===============================
export async function searchAnime(query) {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime?q=${query}&limit=12`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Erro ao buscar anime:", err);
    return [];
  }
}

// ===============================
// 📺 Detalhes do anime
// ===============================
export async function getAnimeDetails(id) {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime/${id}/full`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error("Erro ao buscar detalhes:", err);
    return null;
  }
}

// ===============================
// 🎬 Buscar episódios (Gogoanime)
// ===============================
export async function getEpisodes(title) {
  try {
    const res = await fetch(
      `${CONSUMET_BASE}/anime/gogoanime/${encodeURIComponent(title)}`
    );
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      throw new Error("Nenhum resultado no Gogoanime");
    }

    const animeId = data.results[0].id;

    const epRes = await fetch(
      `${CONSUMET_BASE}/anime/gogoanime/info/${animeId}`
    );
    const epData = await epRes.json();

    return epData.episodes || [];
  } catch (err) {
    console.warn("Gogoanime falhou, tentando Animepahe...");

    try {
      const res = await fetch(
        `${CONSUMET_BASE}/anime/animepahe/${encodeURIComponent(title)}`
      );
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        throw new Error("Nenhum resultado no Animepahe");
      }

      const animeId = data.results[0].id;

      const epRes = await fetch(
        `${CONSUMET_BASE}/anime/animepahe/info/${animeId}`
      );
      const epData = await epRes.json();

      return epData.episodes || [];
    } catch (err2) {
      console.error("Todos os provedores falharam:", err2);
      return [];
    }
  }
}

// ===============================
// ▶️ Buscar link do player
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

    throw new Error("Sem fontes disponíveis");
  } catch (err) {
    console.error("Erro ao buscar streaming:", err);
    return null;
  }
}
