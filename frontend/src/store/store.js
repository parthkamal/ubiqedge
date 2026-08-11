import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import usersReducer from './usersSlice';
import accountsReducer from './accountsSlice';
import devicesReducer from './devicesSlice';
import pricingReducer from './pricingSlice';
import invoicesReducer from './invoicesSlice';
import telemetryReducer from './telemetrySlice';
import paymentsReducer from './paymentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    accounts: accountsReducer,
    devices: devicesReducer,
    pricing: pricingReducer,
    invoices: invoicesReducer,
    telemetry: telemetryReducer,
    payments: paymentsReducer,
  },
});
