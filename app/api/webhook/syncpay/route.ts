import { NextRequest, NextResponse } from 'next/server'

// Webhook para receber notificacoes do SyncPay sobre pagamentos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[SyncPay Webhook] Recebido:', JSON.stringify(body, null, 2))

    // SyncPay pode enviar diferentes formatos de payload
    const identifier = body.identifier || body.id || body.transaction_id
    const status = body.status || body.payment_status
    const amount = body.amount || body.value

    // Status de pagamento confirmado no SyncPay
    const paidStatuses = ['paid', 'completed', 'approved', 'confirmed', 'success']
    
    if (paidStatuses.includes(status?.toLowerCase())) {
      // Pagamento confirmado!
      console.log(`[SyncPay Webhook] Pagamento confirmado! ID: ${identifier}, Valor: ${amount}`)
      
      // Aqui voce pode:
      // 1. Atualizar o banco de dados
      // 2. Liberar acesso ao conteudo
      // 3. Enviar email de confirmacao
      // 4. Adicionar usuario ao grupo VIP
      
      // Exemplo: salvar no banco de dados (descomente quando tiver DB)
      // await db.payments.update({
      //   where: { identifier },
      //   data: { status: 'paid', paidAt: new Date() }
      // })
    } else if (status?.toLowerCase() === 'expired' || status?.toLowerCase() === 'cancelled') {
      // Pagamento expirado ou cancelado
      console.log(`[SyncPay Webhook] Pagamento ${status}! ID: ${identifier}`)
    }

    return NextResponse.json({ received: true, status: 'ok' })

  } catch (error) {
    console.error('[SyncPay Webhook Error]', error)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

// Aceita requisicoes GET para verificacao do endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    provider: 'SyncPay',
    message: 'Webhook SyncPay ativo e pronto para receber notificacoes'
  })
}
