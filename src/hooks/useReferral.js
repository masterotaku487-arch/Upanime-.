// src/hooks/useReferral.js
// Gerencia o sistema de convites VIP
// Quando alguém acessa /?ref=CODE, registra o referral

import { useEffect } from 'react'
import { registerReferral, getReferralCount, updateProfile } from '../services/supabase'
import { useAuth } from '../context/AuthContext'

const VIP_THRESHOLD = 10 // convites únicos para virar VIP

export function useReferral() {
  const { user } = useAuth()

  useEffect(() => {
    processIncomingReferral()
  }, [])

  const processIncomingReferral = async () => {
    const params     = new URLSearchParams(window.location.search)
    const refCode    = params.get('ref')
    if (!refCode) return

    // Busca o referrer pelo código
    try {
      const res = await fetch(
        `https://umpukpyfwfqdkurrlojn.supabase.co/rest/v1/profiles?referral_code=eq.${refCode}&select=id,is_vip`,
        {
          headers: {
            apikey: 'sb_publishable_DXd5goRi1Vl3PcKp1EMbbw_q50v-lTK',
            Authorization: 'Bearer sb_publishable_DXd5goRi1Vl3PcKp1EMbbw_q50v-lTK',
          }
        }
      )
      const [referrer] = await res.json()
      if (!referrer) return

      // Pega IP do visitante via serviço público
      let ip = 'unknown'
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        ip = ipData.ip
      } catch {}

      // Registra o referral (ignora se já existe)
      await registerReferral(referrer.id, ip)

      // Remove o ?ref da URL sem recarregar
      const url = new URL(window.location.href)
      url.searchParams.delete('ref')
      window.history.replaceState({}, '', url.toString())
    } catch (e) {
      console.warn('[Referral] erro:', e.message)
    }
  }

  // Gera link de convite para o usuário atual
  const getReferralLink = () => {
    if (!user?.referral_code) return null
    return `${window.location.origin}/?ref=${user.referral_code}`
  }

  // Busca quantos convites o usuário tem
  const getMyReferralCount = async () => {
    if (!user) return 0
    return getReferralCount(user.id)
  }

  return { getReferralLink, getMyReferralCount, VIP_THRESHOLD }
}
