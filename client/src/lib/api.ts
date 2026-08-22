/**
 * Upanime API Client - Multi-Source Integration
 * Metadados: AniList GraphQL
 * Vídeo: Shinokai (via Worker Túnel), DriveA, AnimeQ
 */

const ANILIST_API = "https://graphql.anilist.co";
const SHINOKAI_TUNNEL = "https://curly.masterotaku487.workers.dev"; // Seu Worker Túnel

export interface Anime {
  id: string;
  malId: number;
  title: string;
  originalTitle?: string;
  posterUrl: string;
  bannerUrl?: string;
  synopsis?: string;
  type?: string;
  episodesCount?: number;
  releaseYear?: number;
  genres: string[];
  status?: string;
}

export interface Episode {
  id: string;
  number: number;
  title?: string;
  variants: EpisodeVariant[];
}

export interface EpisodeVariant {
  variantId: string;
  audioType: "DUBBED" | "SUBTITLED";
}

export const api = {
  async fetchAniList(query: string, variables: any = {}) {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await response.json();
    return json.data;
  },

  async getHome() {
    const query = `
      query {
        trending: Page(page: 1, perPage: 12) {
          media(type: ANIME, sort: TRENDING_DESC) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description
            format
            episodes
            seasonYear
            genres
            status
          }
        }
      }
    `;
    const data = await this.fetchAniList(query);
    return {
      trending: data.trending.media.map(this.mapAniListToAnime)
    };
  },

  async search(q: string) {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 24) {
          media(search: $search, type: ANIME) {
            id
            idMal
            title { romaji english native }
            coverImage { large }
            bannerImage
            format
            episodes
            seasonYear
            genres
          }
        }
      }
    `;
    const data = await this.fetchAniList(query, { search: q });
    return data.Page.media.map(this.mapAniListToAnime);
  },

  async getDetails(id: string) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge }
          bannerImage
          description
          format
          episodes
          seasonYear
          genres
          status
        }
      }
    `;
    const data = await this.fetchAniList(query, { id: parseInt(id) });
    return this.mapAniListToAnime(data.Media);
  },

  mapAniListToAnime(m: any): Anime {
    return {
      id: String(m.id),
      malId: m.idMal || m.id,
      title: m.title.english || m.title.romaji,
      originalTitle: m.title.native,
      posterUrl: m.coverImage.extraLarge || m.coverImage.large,
      bannerUrl: m.bannerImage,
      synopsis: m.description?.replace(/<[^>]*>?/gm, ''),
      type: m.format,
      episodesCount: m.episodes,
      releaseYear: m.seasonYear,
      genres: m.genres,
      status: m.status
    };
  },

  // Lógica de Vídeo - Busca no Shinokai via Túnel
  async getEpisodes(animeId: string) {
    try {
      const anime = await this.getDetails(animeId);
      const searchTitle = anime.title;

      const searchRes = await fetch(`${SHINOKAI_TUNNEL}/medias?q=${encodeURIComponent(searchTitle)}`);
      const searchData = await searchRes.json();
      
      if (!searchData || !searchData.results || searchData.results.length === 0) return [];
      
      const shinokaiId = searchData.results[0].id;

      const epsRes = await fetch(`${SHINOKAI_TUNNEL}/medias/${shinokaiId}/episodes`);
      const epsData = await epsRes.json();

      return epsData.results.map((ep: any) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        variants: ep.variants.map((v: any) => ({
          variantId: v.variantId,
          audioType: v.audioType,
        }))
      }));
    } catch (e) {
      console.error("Erro ao buscar episódios no Shinokai:", e);
      return [];
    }
  },

  async getPlayUrl(animeId: string, episodeId: string, variantId: string) {
    try {
      const anime = await this.getDetails(animeId);
      const searchTitle = anime.title;

      const searchRes = await fetch(`${SHINOKAI_TUNNEL}/medias?q=${encodeURIComponent(searchTitle)}`);
      const searchData = await searchRes.json();
      const shinokaiId = searchData.results[0].id;

      const playRes = await fetch(`${SHINOKAI_TUNNEL}/medias/${shinokaiId}/episodes/${episodeId}/play?variantId=${variantId}`);
      const playData = await playRes.json();
      return playData.url;
    } catch (e) {
      console.error("Erro ao obter URL de stream:", e);
      return null;
    }
  }
};
