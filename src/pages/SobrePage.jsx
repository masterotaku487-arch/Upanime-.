import { Link } from 'react-router-dom'
import './LegalPage.css'

export default function SobrePage() {
  return (
    <div className="legal-page container">
      <div className="legal-header">
        <h1>Sobre o <span>Up Anime+</span></h1>
        <p>A plataforma de animes feita para a comunidade brasileira 🇧🇷</p>
      </div>

      <div className="legal-body">
        <section>
          <h2>🎌 O que é o Up Anime+?</h2>
          <p>
            O <strong>Up Anime+</strong> é uma plataforma gratuita para assistir animes online em HD,
            com episódios legendados e dublados em português. Criado para facilitar o acesso da
            comunidade brasileira aos animes sem precisar navegar por sites complicados ou cheios
            de anúncios.
          </p>
        </section>

        <section>
          <h2>⚙️ Como funciona?</h2>
          <p>
            O site usa uma combinação de fontes para entregar o melhor vídeo possível. Quando você
            aperta play, ele tenta automaticamente:
          </p>
          <ol>
            <li><strong>🇧🇷 AnimeFire</strong> — fonte principal com episódios em português</li>
            <li><strong>🌐 animesonlinecc.to</strong> — fallback automático caso o principal falhe</li>
            <li><strong>🎬 animeshd.to</strong> — terceira opção de fallback</li>
          </ol>
          <p>
            Todo esse processo acontece em segundos, de forma invisível para o usuário.
            O catálogo é alimentado pela API pública do <strong>MyAnimeList (Jikan)</strong>.
          </p>
        </section>

        <section>
          <h2>🛠️ Tecnologia</h2>
          <p>
            Desenvolvido com <strong>React + Vite</strong>, hospedado na <strong>Vercel</strong>
            e usando <strong>Cloudflare Workers</strong> como proxies para as fontes de vídeo.
            Toda a lógica de busca e fallback roda em menos de 3 segundos.
          </p>
        </section>

        <section>
          <h2>📺 Canal no YouTube</h2>
          <p>
            O Up Anime+ apoia criadores de conteúdo de anime. Acompanhe o canal parceiro
            para recomendações e novidades:
          </p>
          <a
            href="https://youtube.com/@kazu_sempau-chan"
            target="_blank"
            rel="noreferrer"
            className="sobre-yt-btn"
          >
            📺 Kazu Sempai no YouTube
          </a>
        </section>

        <section>
          <h2>⚠️ Aviso legal</h2>
          <p>
            O Up Anime+ não hospeda nem distribui arquivos de vídeo. Todo o conteúdo é
            proveniente de fontes externas. Os direitos autorais pertencem aos criadores e
            distribuidoras dos animes. O site é oferecido sem fins lucrativos.
          </p>
        </section>

        <div className="sobre-links">
          <Link to="/termos">📄 Termos de Uso</Link>
          <Link to="/privacidade">🛡️ Privacidade</Link>
          <Link to="/api-status">📊 Status dos Serviços</Link>
        </div>
      </div>
    </div>
  )
}
