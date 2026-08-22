/**
 * Upanime Video Sources Resolver
 * Portado da lógica Ruby para TypeScript
 */

const WORKERS = {
  DRIVEA: "https://drivea.masterotaku487.workers.dev",
  ANIME_Q: "https://aq.masterotaku487.workers.dev",
  ANITUBE: "https://at.masterotaku487.workers.dev",
  SHINOKAI: "https://curly.masterotaku487.workers.dev"
};

const TUNNEL_SECRET = "Q4hsu7Fbusnksi26up";

export interface StreamSource {
  url: string;
  label: string;
  quality: string;
  provider: string;
  isEmbed?: boolean;
}

export const VideoSources = {
  // Limpa o título para gerar slugs compatíveis
  cleanTitle(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  },

  async resolveAll(animeTitle: string, episode: number, isDub: boolean): Promise<StreamSource[]> {
    const slug = this.cleanTitle(animeTitle);
    const sources: StreamSource[] = [];

    // 1. Tentar Shinokai (via Túnel)
    try {
      const searchRes = await fetch(`${WORKERS.SHINOKAI}/medias?q=${encodeURIComponent(animeTitle)}`, {
        headers: { "X-Tunnel-Secret": TUNNEL_SECRET }
      });
      const searchData = await searchRes.json();
      if (searchData && searchData.length > 0) {
        const shinokaiId = searchData[0].id;
        const epsRes = await fetch(`${WORKERS.SHINOKAI}/medias/${shinokaiId}/episodes`, {
          headers: { "X-Tunnel-Secret": TUNNEL_SECRET }
        });
        const epsData = await epsRes.json();
        const ep = epsData.find((e: any) => e.number === episode);
        if (ep) {
          const variant = ep.variants.find((v: any) => 
            isDub ? v.name.toLowerCase().includes("dub") : v.name.toLowerCase().includes("leg")
          );
          if (variant) {
            const playUrl = await fetch(`${WORKERS.SHINOKAI}/medias/${shinokaiId}/episodes/${ep.id}/play?variantId=${variant.variantId}`, {
              headers: { "X-Tunnel-Secret": TUNNEL_SECRET }
            }).then(r => r.json()).then(d => d.url);
            
            if (playUrl) {
              sources.push({
                url: playUrl,
                label: variant.name,
                quality: "Auto",
                provider: "Shinokai"
              });
            }
          }
        }
      }
    } catch (e) { console.error("Shinokai failed", e); }

    // 2. Tentar DriveA
    try {
      const driveRes = await fetch(`${WORKERS.DRIVEA}/?title=${slug}&ep=${episode}&dub=${isDub ? 1 : 0}`);
      const driveData = await driveRes.json();
      if (driveData && driveData.sources) {
        driveData.sources.forEach((s: any) => {
          sources.push({
            url: s.url,
            label: s.label || "HD",
            quality: s.quality || "720p",
            provider: "DriveA"
          });
        });
      }
    } catch (e) { console.error("DriveA failed", e); }

    // 3. Tentar AnimeQ
    try {
      const aqRes = await fetch(`${WORKERS.ANIME_Q}/?title=${slug}&ep=${episode}&dub=${isDub ? 1 : 0}`);
      const aqData = await aqRes.json();
      if (aqData && aqData.url) {
        sources.push({
          url: aqData.url,
          label: aqData.label || "SD",
          quality: aqData.quality || "480p",
          provider: "AnimeQ"
        });
      }
    } catch (e) { console.error("AnimeQ failed", e); }

    return sources;
  }
};
