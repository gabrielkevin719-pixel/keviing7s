"use client"

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

export default function PrivacyPage() {
  const [promotionsOpen, setPromotionsOpen] = useState(true)
  const [showPixModal, setShowPixModal] = useState(false)
  const [pixModalState, setPixModalState] = useState<'form' | 'loading' | 'pix' | 'success' | 'error'>('form')
  const [pixPlanLabel, setPixPlanLabel] = useState('')
  const [pixAmount, setPixAmount] = useState(0)
  const [pixCode, setPixCode] = useState('')
  const [pixQrUrl, setPixQrUrl] = useState('')
  const [pixIdentifier, setPixIdentifier] = useState('')
  const [pixTimer, setPixTimer] = useState('15:00')
  const [pixError, setPixError] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerCpf, setCustomerCpf] = useState('')
  const [formErrors, setFormErrors] = useState<{ email?: string; cpf?: string }>({})
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }

  const isValidCpf = (value: string) => {
    const cpf = value.replace(/\D/g, '')
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

    const calculateDigit = (length: number) => {
      const sum = cpf
        .slice(0, length)
        .split('')
        .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
      const remainder = (sum * 10) % 11
      return remainder === 10 ? 0 : remainder
    }

    return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
  }

  const abrirPixDireto = (planLabel: string, amount: number) => {
    setPixPlanLabel(planLabel)
    setPixAmount(amount)
    setPixError('')
    setFormErrors({})
    setPixModalState('form')
    setShowPixModal(true)
  }

  const fecharPixModal = () => {
    setShowPixModal(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const handlePixSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const email = customerEmail.trim().toLowerCase()
    const errors: { email?: string; cpf?: string } = {}

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Digite um e-mail válido.'
    }
    if (!isValidCpf(customerCpf)) {
      errors.cpf = 'Digite um CPF válido.'
    }

    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    void gerarPix(pixPlanLabel, pixAmount, email, customerCpf.replace(/\D/g, ''))
  }

  const gerarPix = async (planLabel: string, amount: number, email: string, cpf: string) => {
    setPixModalState('loading')
    setPixError('')

    try {
      // Chama a API do SyncPay
      const response = await fetch('/api/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          cpf,
          amount,
          plan: planLabel
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar PIX')
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.pix_code)}`

      setPixCode(data.pix_code)
      setPixQrUrl(qrUrl)
      setPixIdentifier(data.identifier)
      setPixModalState('pix')
      iniciarTimer(15 * 60)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar PIX'
      setPixError(errorMessage)
      setPixModalState('error')
    }
  }

  const iniciarTimer = (segundos: number) => {
    let rem = segundos
    timerRef.current = setInterval(() => {
      rem--
      const m = Math.floor(rem / 60)
      const s = rem % 60
      setPixTimer(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      if (rem <= 0 && timerRef.current) clearInterval(timerRef.current)
    }, 1000)
  }

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(pixCode)
      alert('Código PIX copiado!')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = pixCode
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      alert('Código PIX copiado!')
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Montserrat', sans-serif;
          background-color: #f5f5f5;
        }

        .nav-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 24px;
          max-width: 1200px;
          margin: 0 auto;
          height: 56px;
          background-color: #f7f5f3;
          position: relative;
          border-bottom: 1px solid #e5e5e5;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-text {
          font-size: 22px;
          font-weight: 500;
          color: #1f2937;
          letter-spacing: -0.5px;
        }

        .globe-icon {
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          color: #6b7280;
          cursor: pointer;
        }

        .main-container {
          max-width: 580px;
          margin: 24px auto;
          padding: 0 16px;
        }

        .profile-card {
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }

        .cover-section {
          position: relative;
        }

        .cover-image {
          position: relative;
          width: 100%;
          height: 140px;
          overflow: hidden;
          border-radius: 20px 20px 0 0;
        }

        .cover-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-info {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: -40px;
          padding: 0 20px;
          position: relative;
          z-index: 10;
        }

        .profile-text {
          flex: 1;
        }

        .profile-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-top: 46px;
        }

        .stats {
          display: flex;
          gap: 10px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 400;
          flex-shrink: 0;
        }

        .stats span {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .stats .stat-icon {
          opacity: 0.6;
        }

        .profile-image {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          overflow: hidden;
          background: white;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .profile-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-name {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .verified svg {
          width: 18px;
          height: 18px;
        }

        .profile-username {
          color: #111827;
          font-size: 13px;
        }

        .profile-bio {
          padding: 16px 20px;
        }

        .bio-container {
          margin-bottom: 12px;
        }

        .bio-text {
          font-size: 13px;
          color: #374151;
          line-height: 1.6;
          white-space: pre-line;
          overflow: hidden;
        }

        .bio-text.collapsed {
          max-height: 60px;
        }

        .bio-toggle {
          background: none;
          border: none;
          color: #f97316;
          font-weight: 500;
          cursor: pointer;
          font-size: 13px;
          margin-top: 6px;
          display: inline-block;
          margin-bottom: 12px;
        }

        .social-icons {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .social-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .social-icon:hover {
          background: #f3f4f6;
        }

        /* Pricing panel - New Design */
        .pricing-panel {
          padding: 0;
          background: transparent;
          border-radius: 0;
          box-shadow: none;
        }

        .pricing-section-title {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          margin: 0 0 10px 0;
        }

        .plan-card {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(90deg, #f8a68a 0%, #fcd5c5 50%, #fff5f0 100%);
          border: none;
          border-radius: 999px;
          padding: 16px 24px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.2s ease;
          text-decoration: none;
        }

        .plan-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(248, 166, 138, 0.35);
        }

        .plan-card:active {
          transform: translateY(0);
        }

        .plan-card .plan-title {
          font-size: 15px;
          font-weight: 600;
          color: #1f2937;
          letter-spacing: 0.2px;
        }

        .plan-card .plan-price {
          font-size: 15px;
          font-weight: 700;
          color: #1f2937;
        }

        .promotions {
          margin-top: 1.5rem;
        }

        .promotions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          cursor: pointer;
        }

        .promotions-header h4 {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
        }

        .chevron {
          color: #9ca3af;
          transition: transform 0.3s ease;
          display: flex;
          align-items: center;
        }

        /* Content toggle */
        .content-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 20px 0;
          flex-wrap: wrap;
        }

        .toggle-btn {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 20px;
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: #ff6b3d;
          color: white;
        }

        .toggle-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-btn .count {
          font-weight: 700;
        }

        .separator {
          color: #d1d5db;
        }

        /* Feed gallery */
        .feed-gallery {
          max-width: 560px;
          margin: 18px auto 0;
          padding: 0 6px;
        }

        .feed-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .feed-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
        }

        .feed-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
        }

        .feed-avatar {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          object-fit: cover;
          flex: 0 0 auto;
        }

        .feed-head-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
          flex: 1 1 auto;
          min-width: 0;
        }

        .feed-name {
          font-weight: 700;
          color: #111827;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .feed-handle {
          color: #6b7280;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .feed-media {
          position: relative;
          width: 100%;
          aspect-ratio: 9/16;
          background: #f3f4f6;
        }

        .feed-media .locked-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(8px);
        }

        .lock-bubble {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 68px;
          height: 68px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          display: grid;
          place-items: center;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
          color: #9ca3af;
          font-size: 22px;
        }

        .privacy-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 120px;
          height: auto;
          opacity: 0.6;
          pointer-events: none;
        }

        .stats-pill {
          position: absolute;
          bottom: 10px;
          left: 10px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: rgba(17, 24, 39, 0.65);
          color: #fff;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .stats-pill i {
          margin-right: 6px;
        }

        .feed-footer {
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 10px;
          color: #6b7280;
        }

        .feed-footer i {
          font-size: 16px;
        }

        /* FAQ */
        .info-container {
          max-width: 640px;
          margin: 20px auto;
          padding: 0 16px;
        }

        .faq-container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .faq-titulo {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 16px;
        }

        .faq-item {
          border-bottom: 1px solid #e5e7eb;
          padding: 12px 0;
        }

        .faq-item:last-child {
          border-bottom: none;
        }

        .faq-question {
          width: 100%;
          background: none;
          border: none;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }

        .faq-icon::before {
          content: "+";
          display: inline-block;
          width: 20px;
          height: 20px;
          background: #ff6b3d;
          color: white;
          border-radius: 50%;
          text-align: center;
          line-height: 20px;
          font-weight: 700;
          font-size: 14px;
        }

        .faq-item.active .faq-icon::before {
          content: "-";
        }

        .faq-answer {
          display: none;
          padding: 12px 0 4px 28px;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        .faq-item.active .faq-answer {
          display: block;
        }

        /* Footer CTA */
        .footer-cta {
          max-width: 380px;
          margin: 28px auto 16px;
          padding: 0 16px;
        }

        .footer-legal-links {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          padding: 16px;
        }

        .footer-legal-links a {
          color: #6b7280;
          text-decoration: none;
        }

        .footer-legal-links .separator {
          margin: 0 8px;
        }

        /* PIX Modal */
        .pix-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.82);
          z-index: 99999;
          padding: 16px;
          box-sizing: border-box;
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .pix-modal-container {
          background: #fff;
          border-radius: 20px;
          max-width: 420px;
          width: 100%;
          margin: 20px 0;
          overflow: hidden;
          font-family: 'Montserrat', sans-serif;
          position: relative;
        }

        .pix-modal-cover {
          position: relative;
          width: 100%;
          height: 150px;
          background: #e5e7eb;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
        }

        .pix-modal-cover > span,
        .pix-modal-cover img {
          border-radius: 20px 20px 0 0;
        }

        .pix-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.35);
          border: none;
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .pix-modal-avatar {
          position: absolute;
          left: 20px;
          bottom: -36px;
          width: 84px;
          height: 84px;
          border-radius: 50%;
          overflow: hidden;
          border: 4px solid #fff;
          background: #fff;
          z-index: 2;
        }

        .pix-modal-profile {
          padding: 46px 20px 4px 116px;
        }

        .pix-modal-name {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
        }

        .pix-modal-handle {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .pix-benefits-title,
        .pix-payment-title {
          font-size: 18px;
          font-weight: 800;
          color: #1f2937;
          margin: 0 0 12px;
        }

        .pix-benefits-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .pix-benefits-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          color: #374151;
          font-weight: 500;
        }

        .pix-benefits-list li svg {
          flex-shrink: 0;
        }

        .pix-divider {
          height: 1px;
          background: #eceae6;
          margin: 20px 0;
        }

        .pix-value-label {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }

        .pix-value-amount {
          font-size: 24px;
          font-weight: 800;
          color: #1f2937;
          margin: 2px 0 20px;
        }

        .pix-code-field {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 999px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          text-align: left;
          font-family: 'Montserrat', sans-serif;
          margin-bottom: 14px;
        }

        .pix-code-field .pix-code-text {
          flex: 1;
          font-size: 13px;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pix-code-copy-icon {
          color: #9ca3af;
          flex-shrink: 0;
          display: flex;
        }

        .pix-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
        }

        .pix-form-heading {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pix-form-title {
          color: #1f2937;
          font-size: 20px;
          font-weight: 800;
          margin: 0;
        }

        .pix-form-subtitle {
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .pix-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pix-form-label {
          color: #374151;
          font-size: 13px;
          font-weight: 700;
        }

        .pix-form-input {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid #d1d5db;
          border-radius: 12px;
          color: #1f2937;
          background: #fff;
          font: inherit;
          font-size: 16px;
          padding: 13px 14px;
          outline: none;
        }

        .pix-form-input:focus {
          border-color: #ff6b3d;
          box-shadow: 0 0 0 3px rgba(255, 107, 61, 0.14);
        }

        .pix-form-input[aria-invalid='true'] {
          border-color: #dc2626;
        }

        .pix-form-error {
          color: #dc2626;
          font-size: 12px;
          margin: 0;
        }

        .pix-email-notice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-radius: 12px;
          background: #fff5f0;
          color: #374151;
          font-size: 12px;
          line-height: 1.5;
          padding: 12px;
        }

        .pix-email-notice svg {
          color: #ff6b3d;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .pix-form-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .pix-form-summary strong {
          color: #1f2937;
          font-size: 17px;
        }

        .pix-submit-btn {
          width: 100%;
          background: #ff6b3d;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 15px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Montserrat', sans-serif;
          letter-spacing: 0.3px;
        }

        .pix-submit-btn:hover {
          background: #e85b30;
        }

        .pix-loading {
          padding: 40px 20px;
          text-align: center;
        }

        .pix-spinner {
          width: 44px;
          height: 44px;
          border: 4px solid #fcd5c5;
          border-top-color: #f8a68a;
          border-radius: 50%;
          animation: spinPix 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spinPix {
          to { transform: rotate(360deg); }
        }

        @keyframes blinkPix {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .pix-content {
          padding: 20px;
        }

        .pix-qr-container {
          display: flex;
          justify-content: center;
          margin-bottom: 14px;
        }

        .pix-qr-img {
          width: 200px;
          height: 200px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .pix-code-container {
          background: #f3f4f6;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }

        .pix-code-text {
          flex: 1;
          font-size: 11px;
          color: #374151;
          word-break: break-all;
          font-family: monospace;
        }

        .pix-copy-btn {
          background: #ff6b3d;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Montserrat', sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .pix-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          padding: 10px 16px;
          background: #f3f4f6;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .pix-status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ff6b3d;
          animation: blinkPix 1.2s infinite;
          flex-shrink: 0;
        }

        .pix-success {
          padding: 32px 20px;
          text-align: center;
        }

        .pix-success-icon {
          font-size: 56px;
          margin-bottom: 14px;
        }

        .pix-success-title {
          font-size: 22px;
          font-weight: 800;
          color: #047857;
          margin-bottom: 8px;
        }

        .pix-success-text {
          font-size: 14px;
          color: #065f46;
          margin-bottom: 20px;
        }

        .pix-error {
          padding: 32px 20px;
          text-align: center;
        }

        .pix-error-icon {
          font-size: 48px;
          margin-bottom: 14px;
        }

        .pix-error-text {
          font-size: 15px;
          color: #b91c1c;
          font-weight: 600;
          margin-bottom: 20px;
        }

        /* Privacy checkout */
        .pix-modal-overlay {
          padding: 0;
          background: rgba(17, 17, 17, 0.84);
        }

        .pix-modal-container {
          width: min(100%, 684px);
          max-width: 684px;
          min-height: 100vh;
          margin: 0;
          border-radius: 0;
          background: #faf8f5;
          color: #333230;
          overflow: hidden;
        }

        .pix-modal-cover {
          height: 100px;
          border-radius: 0;
          overflow: hidden;
        }

        .pix-modal-cover > span,
        .pix-modal-cover img {
          border-radius: 0;
        }

        .pix-cover-reference {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 30%;
        }

        .pix-avatar-reference {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pix-modal-close {
          top: 10px;
          right: 10px;
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          color: #d6d3d1;
          font-size: 23px;
          font-weight: 300;
        }

        .pix-modal-avatar {
          top: 60px;
          left: 9px;
          bottom: auto;
          width: 118px;
          height: 118px;
          border: 0;
          box-shadow: none;
        }

        .pix-modal-profile {
          min-height: 80px;
          box-sizing: border-box;
          padding: 15px 38px 12px 138px;
        }

        .pix-modal-name {
          font-size: 16px;
          line-height: 1.3;
          font-weight: 500;
          color: #222d3d;
        }

        .pix-modal-handle {
          margin-top: 0;
          font-size: 16px;
          line-height: 1.3;
          color: #7b8490;
        }

        .pix-content {
          padding: 13px 38px 0;
        }

        .pix-benefits-title {
          margin: 0 0 14px;
          font-size: 20px;
          line-height: 1.35;
          font-weight: 700;
          color: #111;
        }

        .pix-benefits-list {
          gap: 7px;
        }

        .pix-benefits-list li {
          gap: 12px;
          font-size: 20px;
          line-height: 1.2;
          font-weight: 400;
          color: #42413f;
        }

        .pix-benefits-list li svg {
          width: 20px;
          height: 20px;
          stroke: #ff8736;
        }

        .pix-divider {
          height: 1px;
          margin: 28px -38px 0;
          background: #d9dce1;
        }

        .pix-payment-section {
          padding: 21px 16px 24px;
        }

        .pix-payment-title {
          margin: 0 0 8px;
          font-size: 26px;
          line-height: 1.3;
          font-weight: 800;
          color: #363533;
        }

        .pix-value-label {
          font-size: 18px;
          line-height: 1.4;
          color: #b0b4bc;
        }

        .pix-value-amount {
          margin: 1px 0 28px;
          font-size: 26px;
          line-height: 1.35;
          font-weight: 800;
          color: #363533;
        }

        .pix-qr-container {
          width: 294px;
          height: 294px;
          box-sizing: border-box;
          margin: 0 auto 30px;
          padding: 20px;
          align-items: center;
          border: 2px solid #172235;
          border-radius: 10px;
          background: #fff;
        }

        .pix-qr-img {
          width: 250px;
          height: 250px;
          border: 0;
          border-radius: 0;
        }

        .pix-code-field {
          height: 51px;
          margin: 0 0 20px;
          padding: 0 18px;
          border: 1px solid #d5dce6;
          border-radius: 24px;
          background: #fbfcfd;
        }

        .pix-code-field .pix-code-text {
          display: block;
          width: 100%;
          font-family: 'Montserrat', sans-serif;
          font-size: 17px;
          line-height: 1;
          font-weight: 400;
          color: #172235;
          text-align: left;
        }

        .pix-copy-key-button {
          width: 100%;
          height: 57px;
          border: 0;
          border-radius: 29px;
          background: linear-gradient(90deg, #ff943f 0%, #f9b0a8 100%);
          color: #172235;
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 500;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .pix-copy-key-button:active {
          transform: scale(0.99);
        }

        /* Popup Overlay */
        .popup-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 9999;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .popup-overlay.active {
          display: flex;
        }

        /* Media Queries */
        @media (max-width: 768px) {
          .nav-container {
            height: 60px;
            padding: 10px 15px;
          }

          .logo {
            width: 140px;
            height: 56px;
          }

          .search-container,
          .nav-icons {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .top-bar-content {
            gap: 10px;
            justify-content: center;
            padding: 0 10px;
          }

          .top-bar-content > img {
            display: none;
          }

          .privacy-logo {
            font-size: 12px;
            padding: 6px 14px;
            background: rgba(255, 255, 255, 0.14);
          }

          .main-container {
            margin: 16px auto;
            padding: 0 12px;
          }

          .profile-info {
            gap: 10px;
            padding: 0 14px;
          }

          .profile-image {
            width: 72px;
            height: 72px;
          }

          .profile-header-row {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            padding-top: 40px;
          }

          .profile-name {
            font-size: 16px;
          }

          .stats {
            gap: 12px;
            flex-wrap: wrap;
          }

          .profile-bio {
            padding: 16px 14px;
          }

          .plan-card {
            padding: 14px 18px;
          }

          .plan-card .plan-title,
          .plan-card .plan-price {
            font-size: 14px;
          }

          .profile-card,
          .content-tabs,
          .feed-section,
          .info-container {
            border-radius: 14px;
          }

          .cover-image {
            height: 132px;
          }

          .content-tabs {
            overflow-x: auto;
          }

          .tab-item {
            min-width: 96px;
            padding: 14px 10px;
            font-size: 13px;
          }

          .feed-grid {
            grid-template-columns: 1fr;
          }

          .faq-container {
            padding: 20px 14px;
          }

          .footer-cta {
            padding: 0 12px;
          }

          .pix-modal-overlay {
            align-items: flex-start;
            overflow-y: auto;
          }

          .pix-modal-container {
            width: 100%;
            max-width: none;
            min-height: 100dvh;
          }

          .pix-modal-cover {
            height: 100px;
          }

          .pix-modal-avatar {
            top: 60px;
            left: 12px;
            width: 88px;
            height: 88px;
          }

          .pix-modal-profile {
            min-height: 72px;
            padding: 14px 16px 10px 112px;
          }

          .pix-modal-name,
          .pix-modal-handle {
            font-size: 14px;
          }

          .pix-content {
            padding: 12px 22px 0;
          }

          .pix-benefits-title {
            font-size: 18px;
          }

          .pix-benefits-list li {
            gap: 10px;
            font-size: 16px;
          }

          .pix-divider {
            margin: 24px -22px 0;
          }

          .pix-payment-section {
            padding: 20px 0 28px;
          }

          .pix-payment-title,
          .pix-value-amount {
            font-size: 24px;
          }

          .pix-value-label {
            font-size: 16px;
          }

          .pix-qr-container {
            width: min(294px, calc(100vw - 44px));
            height: auto;
            aspect-ratio: 1;
            padding: 18px;
          }

          .pix-qr-img {
            width: 100%;
            height: 100%;
          }

          .pix-code-field .pix-code-text {
            font-size: 14px;
          }

          .pix-copy-key-button {
            font-size: 17px;
          }
        }

        @media (max-width: 380px) {
          .trust-inline {
            font-size: 11px;
            gap: 6px;
          }

          .plan-outline {
            padding: 10px 12px;
          }

          .plan-outline .left {
            gap: 6px;
          }

          .mini-badge {
            font-size: 11px;
            padding: 2px 6px;
          }

          .stats {
            gap: 10px;
            font-size: 11px;
          }

          .plan-card {
            padding: 13px 16px;
          }

          .plan-card .plan-title,
          .plan-card .plan-price {
            font-size: 13px;
          }

          .pix-modal-overlay {
            padding: 8px;
          }

          .pix-modal-container {
            margin: 0;
            border-radius: 16px;
          }

          .pix-modal-cover {
            height: 96px;
            border-radius: 16px 16px 0 0;
          }

          .pix-modal-avatar {
            bottom: -28px;
            left: 14px;
            width: 64px;
            height: 64px;
            border-width: 3px;
          }

          .pix-modal-profile {
            min-height: 36px;
            padding: 32px 14px 2px 88px;
          }

          .pix-form {
            gap: 10px;
            padding: 12px 14px 14px;
          }

          .pix-form-title {
            font-size: 18px;
          }

          .pix-form-subtitle,
          .pix-email-notice {
            font-size: 11px;
          }

          .pix-email-notice {
            padding: 9px;
          }

          .pix-form-field {
            gap: 4px;
          }

          .pix-form-input {
            padding: 10px 12px;
          }

          .pix-submit-btn {
            padding: 12px;
          }
        }
      `}</style>

      <header>
        <nav className="navbar">
          <div className="nav-container">
            <div className="logo">
              <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-black-x9vfF42uSamWBvcXtkHvdmGRD53EqX.svg" width={86} height={18} alt="Privacy Logo" unoptimized />
            </div>
            <div className="globe-icon">
              <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/globe-gAiK6gs7MagVRsgKpFhB5lAbv596ed.svg" width={22} height={22} alt="Globe" unoptimized />
            </div>
          </div>
        </nav>
      </header>

      <main>
        <div className="main-container">
          <div className="profile-card">
            <div className="cover-section">
              <div className="cover-image">
                <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/kamylinha%20%281%29-wo8rGRy9AU0QIOkxZiprDZqNsF7GQy.png" width={640} height={350} alt="Imagem de capa" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} unoptimized />
              </div>

              <div className="profile-info">
                <div className="profile-image">
                  <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/perfil1%20%281%29-vkwPEgVvHcHpu7WWLNMjNeiYYz5BUv.png" width={250} height={250} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
                </div>
                <div className="profile-text">
                  <div className="profile-header-row">
                    <div>
                      <div className="profile-name">
                        Vivi Noronha
                        <span className="verified">
                          <svg aria-label="Verificado" fill="#f97316" height="16" role="img" viewBox="0 0 40 40" width="16" xmlns="http://www.w3.org/2000/svg">
                            <title>Verificado</title>
                            <path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z" fillRule="evenodd"></path>
                          </svg>
                        </span>
                      </div>
                      <div className="profile-username">@noronhavivi</div>
                    </div>
                    <div className="stats">
                      <span><svg className="stat-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> 81</span>
                      <span><svg className="stat-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="20" x="2" y="2" rx="2"/><path d="m10 8 6 4-6 4V8z"/></svg> 20</span>
                      <span><svg className="stat-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> 36</span>
                      <span><svg className="stat-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> 13.3K</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-bio">
              <div className="social-icons">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
              </div>

              {/* Pricing Panel */}
              <div className="pricing-panel">
                <p className="pricing-section-title">Assinaturas</p>
                
                <button className="plan-card" onClick={() => abrirPixDireto('15 Dias', 14.90)}>
                  <span className="plan-title">15 Dias</span>
                  <span className="plan-price">R$ 14,90</span>
                </button>

                <div className="promotions">
                  <div className="promotions-header" onClick={() => setPromotionsOpen(!promotionsOpen)}>
                    <h4>Promoções</h4>
                    <span className="chevron" style={{ transform: promotionsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </span>
                  </div>

                  {promotionsOpen && (
                    <>
                      <button className="plan-card" onClick={() => abrirPixDireto('30 Dias', 24.90)}>
                        <span className="plan-title">30 Dias (40% off)</span>
                        <span className="plan-price">R$ 24,90</span>
                      </button>

                      <button className="plan-card" onClick={() => abrirPixDireto('90 Dias', 42.90)}>
                        <span className="plan-title">90 Dias (50% off)</span>
                        <span className="plan-price">R$ 42,90</span>
                      </button>

                      <button className="plan-card" onClick={() => abrirPixDireto('180 Dias', 59.90)}>
                        <span className="plan-title">180 Dias (60% off)</span>
                        <span className="plan-price">R$ 59,90</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="content-toggle">
            <button className="toggle-btn disabled" disabled>
              <span className="count">502</span> Posts
            </button>
            <span className="separator">•</span>
            <button className="toggle-btn active">
              <span className="count">148</span> Videos
            </button>
            <span className="separator">•</span>
            <button className="toggle-btn">
              <span className="count">354</span> Fotos
            </button>
          </div>

          {/* Feed Gallery */}
          <section className="feed-gallery">
            <div className="feed-grid">
              {/* Video 1 */}
              <article className="feed-card">
                <header className="feed-header">
                  <Image className="feed-avatar" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/perfil1%20%281%29-vkwPEgVvHcHpu7WWLNMjNeiYYz5BUv.png" width={28} height={28} alt="Avatar" unoptimized />
                  <div className="feed-head-text">
                    <div className="feed-name">Vivi Noronha</div>
                    <div className="feed-handle">@noronhavivi</div>
                  </div>
                </header>
                <div className="feed-media">
                  <video 
                    className="locked-media" 
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/MW99mEQP_720p-cVwcozR3cE63jN9e48fifC4Av5nMnS.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px)' }} 
                    onMouseEnter={(e) => { e.currentTarget.muted = false }}
                    onMouseLeave={(e) => { e.currentTarget.muted = true }}
                  />
                  <div className="lock-bubble">🔒</div>
                  <div className="stats-pill">
                    <span>156K</span>
                    <span>28K</span>
                  </div>
                </div>
                <footer className="feed-footer">
                  <span>🤍</span>
                  <span>💬</span>
                  <span>🔖</span>
                </footer>
              </article>

              {/* Video 2 */}
              <article className="feed-card">
                <header className="feed-header">
                  <Image className="feed-avatar" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/perfil1%20%281%29-vkwPEgVvHcHpu7WWLNMjNeiYYz5BUv.png" width={28} height={28} alt="Avatar" unoptimized />
                  <div className="feed-head-text">
                    <div className="feed-name">Vivi Noronha</div>
                    <div className="feed-handle">@noronhavivi</div>
                  </div>
                </header>
                <div className="feed-media">
                  <video 
                    className="locked-media" 
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/FjuP8fkp_720p-0nDEFeqyxNTiVgtR5kqFYfjuZmSShe.mp4" 
                    autoPlay 
                    loop 
                    muted
                    playsInline
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px)' }} 
                    onMouseEnter={(e) => { e.currentTarget.muted = false }}
                    onMouseLeave={(e) => { e.currentTarget.muted = true }}
                  />
                  <div className="lock-bubble">🔒</div>
                  <div className="stats-pill">
                    <span>198K</span>
                    <span>35K</span>
                  </div>
                </div>
                <footer className="feed-footer">
                  <span>🤍</span>
                  <span>💬</span>
                  <span>🔖</span>
                </footer>
              </article>

              {/* Imagem */}
              <article className="feed-card">
                <header className="feed-header">
                  <Image className="feed-avatar" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/perfil1%20%281%29-vkwPEgVvHcHpu7WWLNMjNeiYYz5BUv.png" width={28} height={28} alt="Avatar" unoptimized />
                  <div className="feed-head-text">
                    <div className="feed-name">Vivi Noronha</div>
                    <div className="feed-handle">@noronhavivi</div>
                  </div>
                </header>
                <div className="feed-media">
                  <Image className="locked-media" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/imagem3%20%281%29-9gKE8kTbUvc2m9h6jWMrYQam9m5GFH.png" width={400} height={711} alt="Previa" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px)' }} unoptimized />
                  <div className="lock-bubble">🔒</div>
                  <div className="stats-pill">
                    <span>245K</span>
                    <span>42K</span>
                  </div>
                </div>
                <footer className="feed-footer">
                  <span>🤍</span>
                  <span>💬</span>
                  <span>🔖</span>
                </footer>
              </article>
            </div>
          </section>
        </div>

        {/* FAQ */}
        <div className="info-container">
          <div className="faq-container">
            <h2 className="faq-titulo">Perguntas Frequentes</h2>
            <div className="faq-list">
              {[
                { q: 'É sigiloso? Vai aparecer na fatura?', a: 'Sim, é sigiloso. Cobrança discreta, sem nomes chamativos. Seus dados ficam criptografados.' },
                { q: 'Quando tenho acesso depois do pagamento?', a: 'Imediato. Pagamento aprovado = liberação em até 10s e e-mail contendo o login de acesso.' },
                { q: 'Posso cancelar quando quiser? A assinatura renova?', a: 'Sim. Você pode cancelar a renovação automática pela área do assinante a qualquer momento.' },
                { q: 'Tem reembolso?', a: 'Sim. Reembolso de 7 dias sem burocracia. Se não curtir, devolvemos 100%.' },
                { q: 'Como funciona a "Chat telegram"?', a: 'Basta mandar uma mensagem no chat do produtor e combinar.' },
                { q: 'Posso pedir conteúdo personalizado?', a: 'Sim! Solicitações podem ser feitas no chat do produtor, com o conteúdo desejado.' },
              ].map((item, idx) => (
                <FaqItem key={idx} question={item.q} answer={item.a} />
              ))}
            </div>
          </div>
        </div>

        <div className="footer-cta">
          <button className="plan-card" onClick={() => abrirPixDireto('15 Dias', 14.90)}>
            <span className="plan-title">Veja tudo por apenas</span>
            <span className="plan-price">R$ 14,90</span>
          </button>
        </div>

        <p className="footer-legal-links">
          <a href="#">Termos de Uso</a>
          <span className="separator">•</span>
          <a href="#">Política de Privacidade</a>
        </p>
      </main>

      {/* PIX Modal */}
      {showPixModal && (
        <div className="pix-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) fecharPixModal() }}>
          <div className="pix-modal-container">
            <div className="pix-modal-cover">
              <Image
                className="pix-cover-reference"
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/kamylinha%20%281%29-wo8rGRy9AU0QIOkxZiprDZqNsF7GQy.png"
                width={640}
                height={350}
                alt="Imagem de capa de Vivi Noronha"
                unoptimized
              />
              <button className="pix-modal-close" onClick={fecharPixModal} aria-label="Fechar">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="pix-modal-avatar">
              <Image
                className="pix-avatar-reference"
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/perfil1%20%281%29-vkwPEgVvHcHpu7WWLNMjNeiYYz5BUv.png"
                width={250}
                height={250}
                alt="Foto de perfil de Vivi Noronha"
                unoptimized
              />
            </div>

            <div className="pix-modal-profile">
              <div className="pix-modal-name">Vivi Noronha</div>
              <div className="pix-modal-handle">@noronhavivi</div>
            </div>

            {pixModalState === 'form' && (
              <form className="pix-form" onSubmit={handlePixSubmit} noValidate>
                <div className="pix-form-heading">
                  <h3 className="pix-form-title">Receba seu acesso</h3>
                  <p className="pix-form-subtitle">Informe seus dados para gerar o Pix com segurança.</p>
                </div>

                <div className="pix-email-notice">
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-10 5L2 7" />
                  </svg>
                  <span>Depois da confirmação do pagamento, o acesso será enviado diretamente para o e-mail informado.</span>
                </div>

                <div className="pix-form-field">
                  <label className="pix-form-label" htmlFor="pix-email">E-mail</label>
                  <input
                    className="pix-form-input"
                    id="pix-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="voce@email.com"
                    value={customerEmail}
                    onChange={(event) => {
                      setCustomerEmail(event.target.value)
                      if (formErrors.email) setFormErrors((current) => ({ ...current, email: undefined }))
                    }}
                    aria-invalid={Boolean(formErrors.email)}
                    aria-describedby={formErrors.email ? 'pix-email-error' : undefined}
                  />
                  {formErrors.email && <p className="pix-form-error" id="pix-email-error">{formErrors.email}</p>}
                </div>

                <div className="pix-form-field">
                  <label className="pix-form-label" htmlFor="pix-cpf">CPF</label>
                  <input
                    className="pix-form-input"
                    id="pix-cpf"
                    name="cpf"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={customerCpf}
                    onChange={(event) => {
                      setCustomerCpf(formatCpf(event.target.value))
                      if (formErrors.cpf) setFormErrors((current) => ({ ...current, cpf: undefined }))
                    }}
                    aria-invalid={Boolean(formErrors.cpf)}
                    aria-describedby={formErrors.cpf ? 'pix-cpf-error' : undefined}
                  />
                  {formErrors.cpf && <p className="pix-form-error" id="pix-cpf-error">{formErrors.cpf}</p>}
                </div>

                <div className="pix-form-summary">
                  <span>{pixPlanLabel}</span>
                  <strong>R$ {pixAmount.toFixed(2).replace('.', ',')}</strong>
                </div>

                <button className="pix-submit-btn" type="submit">Criar Pix</button>
              </form>
            )}

            {pixModalState === 'loading' && (
              <div className="pix-loading">
                <div className="pix-spinner"></div>
                <p style={{ color: '#374151', fontSize: '15px', fontWeight: 600 }}>Gerando seu PIX...</p>
                <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>Aguarde um instante</p>
              </div>
            )}

            {pixModalState === 'pix' && (
              <div className="pix-content">
                <h3 className="pix-benefits-title">Benefícios exclusivos</h3>
                <ul className="pix-benefits-list">
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Acesso ao conteúdo
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Chat exclusivo com o criador
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Cancele a qualquer hora
                  </li>
                </ul>

                <div className="pix-divider"></div>

                <div className="pix-payment-section">
                  <h3 className="pix-payment-title">Formas de pagamento</h3>
                  <p className="pix-value-label">Valor</p>
                  <p className="pix-value-amount">R$ {pixAmount.toFixed(2).replace('.', ',')}</p>

                  <div className="pix-qr-container">
                    <Image className="pix-qr-img" src={pixQrUrl} width={250} height={250} alt="QR Code PIX" />
                  </div>

                  <button className="pix-code-field" onClick={copiarPix} aria-label="Copiar código PIX">
                    <span className="pix-code-text">{pixCode}</span>
                  </button>

                  <button className="pix-copy-key-button" onClick={copiarPix}>
                    Copiar chave Pix
                  </button>
                </div>
              </div>
            )}

            {pixModalState === 'success' && (
              <div className="pix-success">
                <div className="pix-success-icon">🎉</div>
                <h3 className="pix-success-title">Pagamento confirmado!</h3>
                <p className="pix-success-text">Seu acesso foi liberado. Verifique seu e-mail para o login.</p>
                <button className="pix-submit-btn" onClick={fecharPixModal}>Fechar</button>
              </div>
            )}

            {pixModalState === 'error' && (
              <div className="pix-error">
                <div className="pix-error-icon">⚠️</div>
                <p className="pix-error-text">{pixError || 'Erro ao gerar PIX. Tente novamente.'}</p>
                <button style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }} onClick={fecharPixModal}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`faq-item ${isOpen ? 'active' : ''}`}>
      <button className="faq-question" onClick={() => setIsOpen(!isOpen)}>
        <span className="faq-icon"></span>
        {question}
      </button>
      <div className="faq-answer">{answer}</div>
    </div>
  )
}
