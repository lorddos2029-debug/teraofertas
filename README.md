# Tera Ofertas

Loja estática com 20 páginas de produtos, checkout e página /pix, com API Pix executada no servidor.

## Desenvolvimento

Node.js 24. Execute npm ci e npm run dev. Endereço local: http://127.0.0.1:4317.

## Vercel

Importe este repositório. Configure:

- Framework Preset: Other
- Root Directory: raiz do repositório
- Install Command: npm ci
- Build Command: npm run build
- Output Directory: dist

As imagens, fontes, CSS e JavaScript estão no repositório e são copiados para dist pelo build. Não é necessário baixar imagens externas ao carregar os produtos.

Variáveis:

| Nome | Valor |
|---|---|
| URUSPAY_API_KEY | Chave privada da UrusPay |
| PIX_SIGNING_SECRET | Segredo aleatório longo para assinar consultas |
| META_PIXEL_ID | 2230869777537560 |

Opcionais: URUSPAY_GATEWAY, URUSPAY_CONTA_ID e URUSPAY_WEBHOOK_URL. O token Facebook CAPI continua no painel UrusPay. A integração direta UTMify usa UTMIFY_API_TOKEN no servidor da Vercel. Não coloque tokens em variáveis públicas ou no HTML.

As rotas de produtos usam /slug. O checkout fica em /checkout e a cobrança gerada é exibida em /pix, na mesma aba. As funções /api/pix/charge e /api/pix/status são configuradas em vercel.json.

Após alterar variáveis na Vercel, faça novo deploy. O projeto não contém .env.local nem credenciais privadas.

## Verificação

npm test executa testes locais com respostas simuladas, sem gerar cobranças ou enviar vendas reais. npm run build monta a loja e o HTML do checkout/Pix.

## UTMify: venda gerada e aprovada

- UTMIFY_API_TOKEN: credencial privada da API UTMify.
- PUBLIC_SITE_URL: origem HTTPS publicada, usada para montar o webhook.
- BLOB_READ_WRITE_TOKEN: credencial automática do armazenamento Vercel Blob **privado** de pedidos. Também é aceito BLOB_STORE_ID com OIDC.
- CRON_SECRET: segredo para proteger a reconciliação automática diária.

Ao gerar o Pix, o servidor grava o pedido privado e envia waiting_payment à UTMify. A mesma venda (orderId da UrusPay e mesma createdAt UTC) é atualizada para paid somente após uma consulta autenticada confirmar pago=true ou status=paid e validar o ID e o valor do pedido. O frete integra o total. A taxa do gateway fica em zero pois a API fornecida não retorna o valor dessa taxa.

A URL /api/pix/webhook recebe um token assinado por pedido, enviado no campo webhook_url ao criar a cobrança. O corpo do webhook nunca é usado como prova de pagamento: o servidor consulta a UrusPay. O webhook funciona sem a aba aberta; a consulta do navegador também reenvia sincronizações pendentes. A rotina /api/pix/reconcile executa uma vez ao dia (03:00 UTC) como recuperação adicional, com cursor persistido e proteção por CRON_SECRET.

Pedidos e tentativas de envio persistem em Blob privado. O ETag protege contra envios concorrentes; notificações repetidas não duplicam o pedido e um status pendente não rebaixa uma venda paga. Se a UrusPay já informar rastreamento.utmify=enviado ao criar a cobrança, o envio direto daquele pedido é dispensado para evitar duplicação com a integração nativa.

A integração vale para novos Pix gerados após o deploy. Cobranças antigas não possuem o pedido persistido nem esse webhook; não são importadas retroativamente. Em caso de falha no serviço externo, o envio fica pendente para reenvio; confirme os logs utmify_delivery_success ou utmify_delivery_error e o painel da UTMify. A aprovação em uma compra real ainda precisa ser conferida com o provedor; testes automatizados usam respostas simuladas.

Para receber alertas no celular, habilite as notificações na própria conta/aplicativo UTMify. A loja envia os estados das vendas; as permissões de push do dispositivo são gerenciadas pela UTMify.
