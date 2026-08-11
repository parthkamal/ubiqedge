import { apiRequest } from './backendClient';

export function listDevices(params) {
  return apiRequest('GET', '/devices', { params });
}

export function getDevice(id) {
  return apiRequest('GET', `/devices/${id}`);
}

export function createDevice(body) {
  return apiRequest('POST', '/devices', { body });
}

export function updateDevice(id, body) {
  return apiRequest('PATCH', `/devices/${id}`, { body });
}

export function deleteDevice(id) {
  return apiRequest('DELETE', `/devices/${id}`);
}

export function getDeviceTelemetry(id, params) {
  return apiRequest('GET', `/devices/${id}/telemetry`, { params });
}
