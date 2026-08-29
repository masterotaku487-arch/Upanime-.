import { useState, useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import './PartnerModal.css'

// Edite aqui pra trocar qual parceria aparece em destaque na Home.
// Pra desligar o popup temporariamente, deixe FEATURED_PARTNER = null.
const FEATURED_PARTNER = {
  name: 'Kawaii Animes',
  banner: '/parceiros/kawaii-x-upanime-banner.png',
  text: 'O UpAnime+ foi feito para oferecer a melhor experiência no Android. Mas se você quer assistir também no iPhone, iPad ou PC, agora também pode, graças à nossa parceria com o Kawaii Animes. Toque aqui para acessar o site parceiro.',
  buttonLabel: 'ACESSAR',
  url: 'https://www.mediafire.com/file/yvk75zgnljq6job/Kawaii_Animes.apk/file',
}

const SEEN_KEY = 'upanime_partner_modal_seen'

export default function PartnerModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!FEATURED_PARTNER) return
    // Mostra só uma vez por sessão (sessionStorage some ao fechar a aba/app)
    if (sessionStorage.getItem(SEEN_KEY)) return
    const timer = setTimeout(() => setShow(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  const close = () => {
    setShow(false)
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch {}
  }

  if (!show || !FEATURED_PARTNER) return null

  return (
    <div className="pmodal-backdrop" onClick={close}>
      <div className="pmodal-card" onClick={e => e.stopPropagation()}>
        <button className="pmodal-close" onClick={close} aria-label="Fechar"><FiX /></button>

        <div className="pmodal-banner">
          <img src={FEATURED_PARTNER.banner} alt={`Parceria com ${FEATURED_PARTNER.name}`} />
        </div>

        <p className="pmodal-text">{FEATURED_PARTNER.text}</p>

        <a
          href={FEATURED_PARTNER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pmodal-btn"
          onClick={close}
        >
          {FEATURED_PARTNER.buttonLabel}
        </a>
      </div>
    </div>
  )
}
