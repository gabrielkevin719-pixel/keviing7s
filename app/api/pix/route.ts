import { NextRequest, NextResponse } from 'next/server'

const SYNCPAY_API_URL = 'https://api.syncpayments.com.br'
const CLIENT_ID = process.env.SYNCPAY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SYNCPAY_CLIENT_SECRET || ''

// Cache do token para evitar requisicoes desnecessarias
let cachedToken: { token: string; expiresAt: number } | null = null

// Funcao para obter o token de autenticacao
async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Credenciais do SyncPay não configuradas.')
  }

  // Verifica se tem token em cache e ainda e valido (com margem de 5 minutos)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token
  }

  const response = await fetch(`${SYNCPAY_API_URL}/api/partner/v1/auth-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  })

  const responseText = await response.text()

  if (!response.ok) {
    console.error('[SyncPay Auth Error]', responseText)
    throw new Error('Falha na autenticacao com SyncPay')
  }

  let data
  try {
    data = JSON.parse(responseText)
  } catch {
    console.error('[SyncPay Auth Parse Error]', responseText)
    throw new Error('Resposta invalida da autenticacao SyncPay')
  }

  if (!data.access_token) {
    throw new Error(data.message || 'O SyncPay não retornou um token de acesso.')
  }

  // Armazena o token em cache (expira em 1 hora por padrao)
  const expiresIn = Number(data.expires_in) || 3600
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  }

  return data.access_token
}

function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const calculateDigit = (base: string, initialWeight: number) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * (initialWeight - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(cpf.slice(0, 9), 10) === Number(cpf[9])
    && calculateDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, plan, name, email, cpf, phone } = body

    // Validacoes basicas
    if (!amount) {
      return NextResponse.json(
        { error: 'Valor do pagamento é obrigatório.' },
        { status: 400 }
      )
    }

    const emailClean = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    }

    if (typeof cpf !== 'string' || !isValidCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 })
    }

    // Limpa CPF e telefone
    const cpfClean = cpf.replace(/\D/g, '')
    const phoneClean = phone?.replace(/\D/g, '') || '11999999999'

    // Normaliza o valor (substitui virgula por ponto se necessario)
    const amountNormalized = String(amount).replace(',', '.')
    // Valor em reais (double) para SyncPay - NAO converter para centavos
    const amountValue = parseFloat(amountNormalized)

    // Obtem o token de autenticacao
    const accessToken = await getAccessToken()

    // URL do webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://keviing7s.vercel.app'}/api/webhook/syncpay`

    // Monta o payload para a API do SyncPay
    const syncpayPayload = {
      amount: amountValue,
      description: plan || 'Pagamento via PIX',
      webhook_url: webhookUrl,
      client: {
        name: name || 'Cliente',
        cpf: cpfClean,
        email: emailClean,
        phone: phoneClean
      }
    }

    // Faz a requisicao para gerar o PIX
    const response = await fetch(`${SYNCPAY_API_URL}/api/partner/v1/cash-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(syncpayPayload)
    })

    const responseText = await response.text()

    // Verifica se a resposta e HTML (erro)
    if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
      return NextResponse.json(
        { error: 'API retornou HTML em vez de JSON. Verifique a URL da API.' },
        { status: 500 }
      )
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      return NextResponse.json(
        { error: `Resposta invalida da API: ${responseText.substring(0, 200)}` },
        { status: 500 }
      )
    }

    if (!response.ok) {
      const errorMsg = data.message || data.error || 'Erro ao gerar PIX'
      console.error('[SyncPay PIX Error]', { status: response.status, message: errorMsg })
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      )
    }

    // A API pode responder HTTP 200 com uma mensagem de erro.
    const pixCode = data.pix_code
    const pixIdentifier = data.identifier

    if (!pixCode || !pixIdentifier) {
      const syncPayMessage = typeof data.message === 'string' ? data.message : ''
      const unauthorized = syncPayMessage.toLowerCase().includes('unauthenticated')
      const error = unauthorized
        ? 'SyncPay recusou a operação. Autorize a chave da API e o IP do projeto no painel SyncPay.'
        : syncPayMessage || 'O SyncPay não retornou o código PIX e o identificador da transação.'

      console.error('[SyncPay CashIn Invalid Response]', {
        hasPixCode: Boolean(pixCode),
        hasIdentifier: Boolean(pixIdentifier),
        message: syncPayMessage
      })

      return NextResponse.json({ error }, { status: unauthorized ? 401 : 502 })
    }

    // Retorna os dados do PIX gerado
    return NextResponse.json({
      success: true,
      pix_code: pixCode,
      pix_qrcode: data.qr_code_base64 || null,
      identifier: pixIdentifier,
      amount: amount,
      status: data.status || 'pending',
      message: 'PIX gerado com sucesso!'
    })

  } catch (error) {
    console.error('[PIX API Error]', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao processar pagamento.'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
