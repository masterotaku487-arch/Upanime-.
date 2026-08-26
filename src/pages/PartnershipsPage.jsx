import { Link } from 'react-router-dom'
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi'
import './PartnershipsPage.css'

// Edite esse array pra adicionar/remover parcerias que aparecem na página.
const PARTNERS = [
  // {
  //   name: 'Nome do Parceiro',
  //   logo: '/parceiros/nome-do-parceiro.png',
  //   desc: 'Uma frase curta explicando a parceria.',
  //   url: 'https://site-do-parceiro.com',
  // },
]

export default function PartnershipsPage() {
  return (
    <div className="partnerships-page container">
      <div className="profile-header partnerships-topbar">
        <Link to="/config" className="back-btn"><FiArrowLeft /> Voltar</Link>
        <h1>Parcerias</h1>
      </div>

      <p className="partnerships-intro">
        Conheça os estúdios, canais e comunidades que colaboram com o Up Anime+.
      </p>

      {PARTNERS.length === 0 ? (
        <div className="partnerships-empty">
          <span className="partnerships-empty-icon">🤝</span>
          <h3>Nenhuma parceria divulgada ainda</h3>
          <p>Em breve mostramos aqui quem colabora com o Up Anime+.</p>
        </div>
      ) : (
        <div className="partnerships-grid">
          {PARTNERS.map(p => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="partner-card">
              {p.logo && <img src={p.logo} alt={p.name} className="partner-logo" />}
              <div className="partner-info">
                <div className="partner-name">{p.name}</div>
                {p.desc && <div className="partner-desc">{p.desc}</div>}
              </div>
              <FiExternalLink className="partner-ext" size={14} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
