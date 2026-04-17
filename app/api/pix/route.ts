import { NextRequest, NextResponse } from 'next/server'

const HOOPAY_API_URL = 'https://api.pay.hoopay.com.br'
const CLIENT_ID = '9065a7048f688d93b268c26a8fc05f1f'
const CLIENT_SECRET = '3398965cf073c04c35326536fefbfcb0c67878baf1cccb12eed2e4e6c67568e9'

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

    // Obtem o IP do cliente de forma segura
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    let clientIp = '177.0.0.1'
    
    if (forwardedFor) {
      const firstIp = forwardedFor.split(',')[0].trim()
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(firstIp)) {
        clientIp = firstIp
      }
    } else if (realIp && /^(\d{1,3}\.){3}\d{1,3}$/.test(realIp)) {
      clientIp = realIp
    }

    const amountValue = parseFloat(amount)

    // Monta o payload para a API do HooPay conforme documentacao Postman
    const hoopayPayload = {
      amount: amountValue,
      customer: {
        email: email,
        name: name,
        phone: phoneClean || '11999999999',
        document: cpfClean || ''
      },
      products: [
        {
          title: `Assinatura Privacy - ${plan || 'Premium'}`,
          amount: amountValue,
          quantity: 1
        }
      ],
      payments: [
        {
          amount: amountValue,
          type: 'pix'
        }
      ],
      data: {
        ip: clientIp,
        callbackURL: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://keviing7s.vercel.app'}/api/webhook/hoopay`
      }
    }

    // Cria o header de autenticacao Basic Auth
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

    // Faz a requisicao para gerar o PIX
    const response = await fetch(`${HOOPAY_API_URL}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify(hoopayPayload)
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

    if (!response.ok || data.payment?.hasErrors) {
      const errorMsg = data.errors?.[0]?.message || data.payment?.message || data.message || 'Erro ao gerar PIX'
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      )
    }

    // Extrai os dados do PIX da resposta conforme documentacao HooPay
    const pixCharge = data.payment?.charges?.find((c: { type: string }) => 
      c.type === 'pix' || c.type === 'PIX'
    )
    const pixPayload = pixCharge?.pixPayload // Codigo copia e cola
    const pixQrCode = pixCharge?.pixQrCode // Imagem QR Code em base64
    const pixIdentifier = pixCharge?.uuid || data.payment?.charges?.[0]?.uuid

    // Retorna os dados do PIX gerado
    return NextResponse.json({
      success: true,
      pix_code: pixPayload,
      pix_qrcode: pixQrCode,
      identifier: pixIdentifier,
      amount: amount,
      status: data.payment?.status || 'pending',
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
