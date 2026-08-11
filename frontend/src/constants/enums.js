// mirrors backend enums exactly (string values are sent to/received from
// the API, so these must match byte-for-byte) — see:
//   backend/src/user/entities/role.entity.ts            (RoleType)
//   backend/src/device/entities/device-type.entity.ts   (DeviceTypeEnum)
//   backend/src/device/entities/device-type-param.entity.ts (ParamKey)
//   backend/src/account/entities/customer-connection.entity.ts (ConnectionStatus)
//   backend/src/pricing/entities/pricing-config.entity.ts (RateType)
//   backend/src/invoice/entities/customer-invoice.entity.ts (InvoiceStatus)
//   backend/src/payment/entities/payment-transaction.entity.ts (PaymentStatus)

export const RoleType = Object.freeze({
  ADMIN: 'Admin',
  CUSTOMER: 'Customer',
});

export const DeviceType = Object.freeze({
  TANK: 'TANK',
  METER: 'METER',
});

export const ParamKey = Object.freeze({
  LEVEL: 'LEVEL',
  TOTAL: 'TOTAL',
  FLOW: 'FLOW',
});

export const ConnectionStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
});

export const RateType = Object.freeze({
  FIXED: 'FIXED',
  SLAB: 'SLAB',
});

export const InvoiceStatus = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
});

export const PaymentStatus = Object.freeze({
  INITIATED: 'INITIATED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
});

export const TelemetryRangePreset = Object.freeze({
  DAY: '1d',
  WEEK: '7d',
  MONTH: '30d',
  CUSTOM: 'custom',
});
