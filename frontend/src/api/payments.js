import { apiRequest } from './backendClient';

export function initiatePayment(invoiceId) {
  return apiRequest('POST', `/invoices/${invoiceId}/pay`);
}

export function listInvoicePayments(invoiceId) {
  return apiRequest('GET', `/invoices/${invoiceId}/payments`);
}
