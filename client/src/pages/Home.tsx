import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, Anime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Play, Search, Film, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [trending, setTrending] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHome() {
      try {
        const data = await api.getHome();
        setTrending(data.trending || []);
      } catch (error) {
        console.error("Erro ao carregar home:", error);
      } finally {
        setLoading(false);
      }
    }
    loadHome();
  }, []);

  if (loading) return <HomeSkeleton />;

  const featured = trending[0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      {featured && (
        <section className="relative h-[80vh] w-full overflow-hidden">
          <img 
            src={featured.bannerUrl || featured.posterUrl} 
            alt={featured.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
          
          <div className="container relative h-full flex flex-col justify-center items-start pt-20">
            <div className="max-w-2xl space-y-6">
              <span className="inline-block bg-primary px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                Em Destaque
              </span>
              <h1 className="font-outfit text-5xl md:text-7xl font-black leading-tight drop-shadow-xl">
                {featured.title}
              </h1>
              <p className="text-lg text-muted-foreground line-clamp-3 max-w-xl">
                {featured.synopsis}
              </p>
              <div className="flex gap-4 pt-4">
                <Link href={`/anime/${featured.id}`}>
                  <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full group">
                    <Play className="mr-2 fill-current group-hover:scale-110 transition-transform" /> Assistir Agora
                  </Button>
                </Link>
                <Link href={`/anime/${featured.id}`}>
                  <Button size="lg" variant="secondary" className="h-14 px-8 text-lg font-bold rounded-full">
                    Mais Detalhes
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="container py-12 space-y-16">
        {/* Trending Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-outfit text-3xl font-black flex items-center gap-3">
              <Play className="text-primary fill-primary w-6 h-6" /> Tendências
            </h2>
            <Link href="/search">
              <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                Ver Tudo
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {trending.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function AnimeCard({ anime }: { anime: Anime }) {
  return (
    <Link href={`/anime/${anime.id}`}>
      <div className="group relative cursor-pointer space-y-3">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 transition-all group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <img 
            src={anime.posterUrl} 
            alt={anime.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
            <span className="text-xs font-bold text-primary mb-1">{anime.type}</span>
            <span className="text-sm font-black text-white line-clamp-2">{anime.title}</span>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {anime.title}
          </h3>
          <p className="text-xs text-muted-foreground">{anime.releaseYear} • {anime.episodesCount || '?'} Eps</p>
        </div>
      </div>
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen space-y-12 pb-20">
      <Skeleton className="h-[80vh] w-full" />
      <div className="container grid grid-cols-2 md:grid-cols-6 gap-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
