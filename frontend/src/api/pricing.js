import { apiRequest } from './backendClient';

export function listPricingConfigs(params) {
  return apiRequest('GET', '/pricing-configs', { params });
}

export function getActivePricingConfig(type) {
  return apiRequest('GET', '/pricing-configs/active', { params: { type } });
}

export function createPricingConfig(body) {
  return apiRequest('POST', '/pricing-configs', { body });
}
