import { NextRequest, NextResponse } from 'next/server'

const SYNCPAY_API_URL = 'https://api.syncpayments.com.br'
const CLIENT_ID = '1674b902-b34b-48b2-b124-f96d55aecdaa'
const CLIENT_SECRET = '03850936-49da-4b86-8df3-8ce7739d0802'

// Funcao para obter o token de acesso
async function getAccessToken() {
  const response = await fetch(`${SYNCPAY_API_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro ao obter token de acesso')
  }

  return data.access_token
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, cpf, phone, amount, plan } = body

    // Validacoes basicas
    if (!name || !email || !amount) {
      return NextResponse.json(
        { error: 'Dados incompletos. Preencha todos os campos obrigatorios.' },
        { status: 400 }
      )
    }

    // Remove formatacao do CPF (apenas numeros)
    const cpfClean = cpf ? cpf.replace(/\D/g, '') : ''
    
    // Remove formatacao do telefone (apenas numeros)
    const phoneClean = phone ? phone.replace(/\D/g, '') : ''

    // Obtem o token de acesso
    const accessToken = await getAccessToken()

    // Calcula o valor em centavos
    const amountInCents = Math.round(parseFloat(amount) * 100)

    // Monta o payload para a API do SyncPayments
    const syncPayPayload = {
      amount: amountInCents,
      paymentMethod: 'pix',
      customer: {
        name: name,
        email: email,
        document: cpfClean,
        phone: phoneClean
      },
      pix: {
        expiresInSeconds: 3600 // 1 hora para pagar
      },
      metadata: {
        plan: plan || 'Premium',
        description: `Assinatura Privacy - Plano ${plan || 'Premium'}`
      }
    }

    console.log('[v0] Enviando para SyncPay:', JSON.stringify(syncPayPayload, null, 2))

    // Faz a requisicao para gerar o PIX
    const response = await fetch(`${SYNCPAY_API_URL}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(syncPayPayload)
    })

    const data = await response.json()
    console.log('[v0] Resposta SyncPay PIX:', response.status, JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[SyncPay Error]', data)
      const errorMsg = data.message || data.error || 'Erro ao gerar PIX. Tente novamente.'
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      )
    }

    // Extrai os dados do PIX da resposta
    const pixCode = data.pix?.qrCode || data.pix?.emv || data.pix?.brcode || data.qrCode
    const pixQrCodeImage = data.pix?.qrCodeImage || data.qrCodeImage
    const transactionId = data.id || data.transactionId

    // Retorna os dados do PIX gerado
    return NextResponse.json({
      success: true,
      pix_code: pixCode,
      pix_qrcode: pixQrCodeImage,
      identifier: transactionId,
      amount: amount,
      status: data.status,
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
