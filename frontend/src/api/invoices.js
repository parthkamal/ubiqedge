import { apiRequest } from './backendClient';

export function listInvoices(params) {
  return apiRequest('GET', '/invoices', { params });
}

export function getInvoice(id) {
  return apiRequest('GET', `/invoices/${id}`);
}

export function generateInvoices(body) {
  return apiRequest('POST', '/invoices/generate', { body });
}

export function cancelInvoice(id) {
  return apiRequest('PATCH', `/invoices/${id}/cancel`);
}
