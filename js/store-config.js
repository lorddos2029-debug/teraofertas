window.STORE_CONFIG = {
  // Link opcional do provedor de pagamento (não é a rota do checkout local).
  checkoutUrl: '',
  productCheckoutUrls: {},
  appendOrderParams: false,
  // Frete do modelo de checkout fornecido. Valor em reais.
  checkoutShippingAmount: 0,
  // Sua API de geração de Pix. Credenciais devem ficar no servidor.
  pixEndpoint: '/api/pix/charge'
};
