import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = '842758524960-b4pd55oqc6qsopgjeukin7r6q98td5tl.apps.googleusercontent.com'

export default function LoginModal({ onClose }) {
  const { login } = useAuth()
  const btnRef = useRef(null)

  useEffect(() => {
    // Renderiza botão oficial do Google
    if (window.google && btnRef.current) {
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 280,
        text: 'signin_with',
        locale: 'pt-BR',
      })
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: '36px 32px', width: 340,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        }}
        onClick={e => e.stopPropagation()}
      >
        <img src="/logo.png" alt="Up Anime+" style={{ width: 52, height: 52 }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Entrar no Up Anime+</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            Salve seus animes favoritos e acompanhe seu histórico
          </p>
        </div>

        {/* Botão oficial Google */}
        <div ref={btnRef} />

        {/* Fallback se SDK não carregar */}
        <button
          onClick={login}
          style={{
            display: 'none', // fica escondido, só aparece se o botão do Google falhar
            width: '100%', padding: '12px 20px',
            background: '#fff', color: '#111', borderRadius: 8,
            border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <img src="https://www.google.com/favicon.ico" width={18} alt="" />
          Entrar com Google
        </button>

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center' }}>
          Ao entrar, você concorda com nossos{' '}
          <a href="/termos" style={{ color: 'rgba(255,255,255,0.4)' }}>Termos de Uso</a>
        </p>
      </div>
    </div>
  )
}
