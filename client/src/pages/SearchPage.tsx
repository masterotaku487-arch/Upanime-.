import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api, Anime } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchPage() {
  const [location] = useLocation();
  const queryParams = new URLSearchParams(location.split('?')[1]);
  const initialQuery = queryParams.get('q') || "";
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await api.search(q);
      setResults(data);
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="font-outfit text-4xl font-black">Busca</h1>
          </div>
          
          <div className="relative w-full md:max-w-md">
            <Input 
              placeholder="Digite o nome do anime..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              className="h-12 pl-12 rounded-full bg-secondary/50 border-white/10 focus:border-primary/50 transition-all"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Button 
              onClick={() => handleSearch(searchQuery)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-10 px-4"
            >
              Buscar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {results.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : searchQuery && (
          <div className="text-center py-24 space-y-4">
            <div className="text-6xl">🔍</div>
            <h2 className="text-2xl font-bold">Nenhum resultado encontrado</h2>
            <p className="text-muted-foreground">Tente buscar por outro termo ou verifique a ortografia.</p>
          </div>
        )}
      </div>
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
