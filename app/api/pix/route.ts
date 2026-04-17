import { NextRequest, NextResponse } from 'next/server'

const HOOPAY_BASE_URL = 'https://api.hoopay.com.br'
const HOOPAY_AUTH_URL = `${HOOPAY_BASE_URL}/oauth/token`
const HOOPAY_PIX_URL = `${HOOPAY_BASE_URL}/v1/pix/charges`

// Funcao para obter token de autenticacao
async function getAuthToken(): Promise<string> {
  const response = await fetch(HOOPAY_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.HOOPAY_CLIENT_ID,
      client_secret: process.env.HOOPAY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  })

  const data = await response.json()
  console.log('[v0] HooPay Auth response:', response.status, JSON.stringify(data, null, 2))

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Erro ao autenticar com HooPay')
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
    if (!process.env.HOOPAY_CLIENT_ID || !process.env.HOOPAY_CLIENT_SECRET) {
      console.error('[v0] Credenciais HooPay nao configuradas')
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
    console.log('[v0] Obtendo token de autenticacao HooPay...')
    const authToken = await getAuthToken()
    console.log('[v0] Token HooPay obtido com sucesso')

    // Monta o payload para a API do HooPay
    const hoopayPayload = {
      amount: parseFloat(amount) * 100, // HooPay usa centavos
      description: `Assinatura Privacy - Plano ${plan}`,
      external_reference: `privacy_${Date.now()}`,
      webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://seu-dominio.com'}/api/webhook/hoopay`,
      payer: {
        name: name,
        document: cpfClean,
        email: email,
        phone: phoneClean
      }
    }

    console.log('[v0] Enviando para HooPay:', JSON.stringify(hoopayPayload, null, 2))

    // Faz a requisicao para gerar o PIX
    const response = await fetch(HOOPAY_PIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(hoopayPayload)
    })

    const data = await response.json()
    console.log('[v0] Resposta HooPay PIX:', response.status, JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[HooPay Error]', data)
      return NextResponse.json(
        { error: data.message || data.error || 'Erro ao gerar PIX. Tente novamente.' },
        { status: response.status }
      )
    }

    // Retorna os dados do PIX gerado
    return NextResponse.json({
      success: true,
      pix_code: data.pix_code || data.qr_code || data.emv || data.brcode,
      identifier: data.id || data.transaction_id || data.identifier,
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
