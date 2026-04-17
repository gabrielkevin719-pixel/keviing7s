import { NextRequest, NextResponse } from 'next/server'

const HOOPAY_API_URL = 'https://api.pay.hoopay.com.br/charge'

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

    // Verifica se as credenciais estao configuradas
    if (!process.env.HOOPAY_CLIENT_ID || !process.env.HOOPAY_CLIENT_SECRET) {
      console.error('[v0] Credenciais HooPay nao configuradas')
      return NextResponse.json(
        { error: 'Configuracao de pagamento incompleta.' },
        { status: 500 }
      )
    }

    // Remove formatacao do CPF (apenas numeros)
    const cpfClean = cpf ? cpf.replace(/\D/g, '') : ''
    
    // Remove formatacao do telefone (apenas numeros)
    const phoneClean = phone ? phone.replace(/\D/g, '') : '00000000000'

    // Cria o header de autenticacao Basic Auth
    const authString = `${process.env.HOOPAY_CLIENT_ID}:${process.env.HOOPAY_CLIENT_SECRET}`
    const authBase64 = Buffer.from(authString).toString('base64')

    // Calcula o valor (HooPay usa valor em reais, nao centavos)
    const amountValue = parseFloat(amount)

    // Monta o payload para a API do HooPay conforme documentacao
    const hoopayPayload = {
      amount: amountValue,
      customer: {
        email: email,
        name: name,
        phone: phoneClean,
        document: cpfClean
      },
      products: [
        {
          title: `Assinatura Privacy - Plano ${plan || 'Premium'}`,
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
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '192.168.0.1',
        callbackURL: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://seu-dominio.com'}/api/webhook/hoopay`
      }
    }

    console.log('[v0] Enviando para HooPay:', JSON.stringify(hoopayPayload, null, 2))

    // Faz a requisicao para gerar o PIX com Basic Auth
    const response = await fetch(HOOPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authBase64}`
      },
      body: JSON.stringify(hoopayPayload)
    })

    const data = await response.json()
    console.log('[v0] Resposta HooPay PIX:', response.status, JSON.stringify(data, null, 2))

    if (!response.ok || data.payment?.hasErrors) {
      console.error('[HooPay Error]', data)
      const errorMsg = data.errors?.[0]?.message || data.payment?.message || 'Erro ao gerar PIX. Tente novamente.'
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      )
    }

    // Extrai os dados do PIX da resposta conforme documentacao HooPay
    const pixCharge = data.payment?.charges?.find((c: { type: string }) => c.type === 'pix' || c.type === 'PIX')
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
      status: data.payment?.status,
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
