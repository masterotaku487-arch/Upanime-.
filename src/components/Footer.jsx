import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <img src="/logo.png" alt="Up Anime+" />
            <span>UP <em>ANIME</em>+</span>
          </Link>
          <p>Assista animes em HD, grátis e sem cadastro. O melhor do universo otaku em um só lugar.</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>Explorar</h4>
            <Link to="/">Início</Link>
            <Link to="/category/airing">Em Exibição</Link>
            <Link to="/category/bypopularity">Populares</Link>
            <Link to="/category/upcoming">Em Breve</Link>
            <Link to="/genres">Gêneros</Link>
          </div>
          <div className="footer-col">
            <h4>Categorias</h4>
            <Link to="/category/movie">Filmes</Link>
            <Link to="/category/tv">Séries TV</Link>
            <Link to="/category/ova">OVAs</Link>
            <Link to="/category/special">Especiais</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom container">
        <p>© {new Date().getFullYear()} Up Anime+. Conteúdo fornecido via APIs públicas.</p>
        <p>Dados por <a href="https://myanimelist.net" target="_blank" rel="noreferrer">MyAnimeList</a> · Jikan API</p>
      </div>
    </footer>
  )
}
