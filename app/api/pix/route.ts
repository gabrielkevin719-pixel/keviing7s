import { NextRequest, NextResponse } from 'next/server'

const SYNCPAY_API_URL = 'https://api.syncpayments.com.br'
const CLIENT_ID = process.env.SYNCPAY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SYNCPAY_CLIENT_SECRET || ''

// Cache do token para evitar requisicoes desnecessarias
let cachedToken: { token: string; expiresAt: number } | null = null

// Funcao para obter o token de autenticacao
async function getAccessToken(): Promise<string> {
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

  // Armazena o token em cache (expira em 1 hora por padrao)
  const expiresIn = data.expires_in || 3600
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  }

  return data.access_token
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, plan, name, email, cpf, phone } = body

    // Validacoes basicas
    if (!amount) {
      return NextResponse.json(
        { error: 'Valor do pagamento e obrigatorio.' },
        { status: 400 }
      )
    }

    // Limpa CPF e telefone
    const cpfClean = cpf?.replace(/\D/g, '') || '00000000000'
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
        email: email || 'cliente@email.com',
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
      console.error('[SyncPay PIX Error]', data)
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      )
    }

    // Extrai os dados do PIX da resposta do SyncPay
    const pixCode = data.pix_code || data.qr_code || data.emv
    const pixIdentifier = data.identifier || data.id || data.transaction_id

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
