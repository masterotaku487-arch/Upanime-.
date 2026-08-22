import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { api, Anime, Episode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Download, Globe, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnimeDetails() {
  const [, params] = useRoute("/anime/:id");
  const animeId = params?.id;
  
  const [anime, setAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEp, setSelectedEp] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!animeId) return;
    
    async function loadDetails() {
      try {
        const found = await api.getDetails(animeId!);
        setAnime(found || null);
        
        const eps = await api.getEpisodes(animeId!);
        setEpisodes(eps);
      } catch (error) {
        console.error("Erro ao carregar detalhes:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [animeId]);

  const handlePlay = async (epId: string, variantId: string) => {
    if (!animeId) return;
    setSelectedEp(epId);
    try {
      const url = await api.getPlayUrl(animeId, epId, variantId);
      setPlayUrl(url);
    } catch (error) {
      console.error("Erro ao obter link:", error);
    }
  };

  if (loading) return <DetailsSkeleton />;
  if (!anime) return <div className="container py-24 text-center">Anime não encontrado.</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Background Banner */}
      <div className="relative h-[60vh] w-full">
        <img 
          src={anime.bannerUrl || anime.posterUrl} 
          alt={anime.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        <div className="container relative h-full flex flex-col justify-end pb-12">
          <Link href="/">
            <Button variant="ghost" className="mb-8 text-white hover:bg-white/10 -ml-4">
              <ChevronLeft className="mr-2" /> Voltar
            </Button>
          </Link>
          <h1 className="font-outfit text-4xl md:text-6xl font-black mb-4">{anime.title}</h1>
          <div className="flex gap-4 text-sm font-medium">
            <span className="bg-primary px-2 py-1 rounded text-white">{anime.type}</span>
            <span className="bg-white/10 px-2 py-1 rounded text-white">{anime.releaseYear}</span>
            <span className="bg-white/10 px-2 py-1 rounded text-white">{anime.status}</span>
          </div>
        </div>
      </div>

      <div className="container py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Sinopse e Info */}
        <div className="lg:col-span-2">
          <h2 className="font-outfit text-2xl font-black mb-4 border-l-4 border-primary pl-4">Sinopse</h2>
          <p className="text-muted-foreground leading-relaxed text-lg mb-8">
            {anime.synopsis}
          </p>

          {/* Player (se ativo) */}
          {playUrl && (
            <div className="mb-12 rounded-2xl overflow-hidden bg-black aspect-video border border-white/10 shadow-2xl">
              <iframe 
                src={playUrl} 
                className="w-full h-full" 
                allowFullScreen 
                title="Player Upanime"
              />
            </div>
          )}

          {/* Episódios */}
          <h2 className="font-outfit text-2xl font-black mb-6 border-l-4 border-primary pl-4">Episódios</h2>
          <div className="space-y-4">
            {episodes.length === 0 ? (
              <p className="text-muted-foreground italic">Nenhum episódio disponível no momento.</p>
            ) : (
              episodes.map((ep) => (
                <div key={ep.id} className="bg-secondary/50 border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-primary/30 transition-colors">
                  <div>
                    <h3 className="font-bold text-lg">Episódio {ep.number}</h3>
                    <p className="text-sm text-muted-foreground">{ep.title || `Lançamento ${ep.number}`}</p>
                  </div>
                  <div className="flex gap-2">
                    {ep.variants.map((v) => (
                      <div key={v.variantId} className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant={selectedEp === ep.id ? "default" : "secondary"}
                          onClick={() => handlePlay(ep.id, v.variantId)}
                          className="font-bold"
                        >
                          <Play className="w-4 h-4 mr-1" /> 
                          {v.audioType === "DUBBED" ? "DUB" : "LEG"}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => window.open(playUrl || '#', '_blank')}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-secondary/30 p-6 rounded-2xl border border-white/5">
            <h3 className="font-outfit text-xl font-black mb-4">Detalhes</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Título Original</span>
                <span className="font-medium text-right ml-4">{anime.originalTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Áudio</span>
                <div className="flex gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
          
          <img 
            src={anime.posterUrl} 
            alt="Poster" 
            className="w-full rounded-2xl shadow-2xl border border-white/10"
          />
        </div>
      </div>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background container py-24 space-y-8">
      <Skeleton className="h-[60vh] w-full rounded-3xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </div>
  );
}
