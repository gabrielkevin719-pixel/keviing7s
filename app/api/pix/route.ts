import { NextRequest, NextResponse } from 'next/server'

const SYNCPAY_BASE_URL = 'https://api.syncpayments.com.br'
const SYNCPAY_AUTH_URL = `${SYNCPAY_BASE_URL}/api/partner/v1/auth-token`
const SYNCPAY_PIX_URL = `${SYNCPAY_BASE_URL}/api/partner/v1/cash-in`

// Funcao para obter token de autenticacao
async function getAuthToken(): Promise<string> {
  const response = await fetch(SYNCPAY_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.SYNCPAY_CLIENT_ID,
      client_secret: process.env.SYNCPAY_CLIENT_SECRET
    })
  })

  const data = await response.json()
  console.log('[v0] Auth response:', response.status, JSON.stringify(data, null, 2))

  if (!response.ok) {
    throw new Error(data.message || 'Erro ao autenticar com SyncPay')
  }

  return data.access_token || data.token
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, cpf, phone, amount, plan } = body

    // Validacoes basicas
    if (!name || !email || !cpf || !amount) {
      return NextResponse.json(
        { error: 'Dados incompletos. Preencha todos os campos obrigatorios.' },
        { status: 400 }
      )
    }

    // Verifica se as credenciais estao configuradas
    if (!process.env.SYNCPAY_CLIENT_ID || !process.env.SYNCPAY_CLIENT_SECRET) {
      console.error('[v0] Credenciais SyncPay nao configuradas')
      return NextResponse.json(
        { error: 'Configuracao de pagamento incompleta.' },
        { status: 500 }
      )
    }

    // Remove formatacao do CPF (apenas numeros)
    const cpfClean = cpf.replace(/\D/g, '')
    
    // Remove formatacao do telefone (apenas numeros)
    const phoneClean = phone ? phone.replace(/\D/g, '') : '00000000000'

    // Obtem token de autenticacao
    console.log('[v0] Obtendo token de autenticacao...')
    const authToken = await getAuthToken()
    console.log('[v0] Token obtido com sucesso')

    // Monta o payload para a API do SyncPay
    const syncpayPayload = {
      amount: parseFloat(amount),
      description: `Assinatura Privacy - Plano ${plan}`,
      webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://seu-dominio.com'}/api/webhook/syncpay`,
      client: {
        name: name,
        cpf: cpfClean,
        email: email,
        phone: phoneClean
      }
    }

    console.log('[v0] Enviando para SyncPay:', JSON.stringify(syncpayPayload, null, 2))

    // Faz a requisicao para gerar o PIX
    const response = await fetch(SYNCPAY_PIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(syncpayPayload)
    })

    const data = await response.json()
    console.log('[v0] Resposta SyncPay PIX:', response.status, JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[SyncPay Error]', data)
      return NextResponse.json(
        { error: data.message || 'Erro ao gerar PIX. Tente novamente.' },
        { status: response.status }
      )
    }

    // Retorna os dados do PIX gerado
    return NextResponse.json({
      success: true,
      pix_code: data.pix_code || data.qr_code || data.emv,
      identifier: data.identifier || data.transaction_id || data.id,
      amount: amount,
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
