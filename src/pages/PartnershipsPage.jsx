import { Link } from 'react-router-dom'
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi'
import './PartnershipsPage.css'

// Edite esse array pra adicionar/remover parcerias que aparecem na página.
const PARTNERS = [
  {
    name: 'Kawaii Animes',
    logo: '/parceiros/kawaii-animes.png',
    desc: 'O UpAnime+ foi feito para ser acessado de qualquer lugar pelo navegador. Mas, se você quer mais agilidade e facilidade, agora também pode baixar o app graças à nossa parceria com o Kawaii Animes. Acesse o app parceiro e aproveite uma experiência mais rápida no Android.',
    url: 'https://www.mediafire.com/file/yvk75zgnljq6job/Kawaii_Animes.apk/file',
  },
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
