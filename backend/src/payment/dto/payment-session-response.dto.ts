// response to POST /invoices/:id/pay — in a real integration this would be
// whatever the gateway's session-init call returns (typically a redirect
// URL to hosted checkout); mocked here since no real gateway is wired up,
// see ubiqedge_tech_implementation_spec
export class PaymentSessionResponseDto {
  transactionId: number;
  provider: string;
  providerTransactionId: string;
  amount: string;
  checkoutUrl: string;
}
