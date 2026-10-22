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

Opcionais: URUSPAY_GATEWAY, URUSPAY_CONTA_ID e URUSPAY_WEBHOOK_URL. Os tokens do Facebook CAPI e da UTMify devem ser cadastrados no painel UrusPay, conforme o contrato do provedor. Não coloque tokens em variáveis públicas ou no HTML.

As rotas de produtos usam /slug. O checkout fica em /checkout e a cobrança gerada é exibida em /pix, na mesma aba. As funções /api/pix/charge e /api/pix/status são configuradas em vercel.json.

Após alterar variáveis na Vercel, faça novo deploy. O projeto não contém .env.local nem credenciais privadas.

## Verificação

npm test executa testes locais com respostas simuladas, sem gerar cobranças ou enviar vendas reais. npm run build monta a loja e o HTML do checkout/Pix.
