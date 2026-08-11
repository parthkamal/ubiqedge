import { createSlice } from '@reduxjs/toolkit';

// shared shape for every server-backed resource slice — list + single-item
// + loading/error state. Hooks (useDevices, useInvoices, ...) dispatch
// these actions around calls to api/*.js; this factory just removes the
// repetition of writing the same reducers 6+ times. See implementation
// spec §8: "server data lives in slices too; loading/error/data state per
// resource" (Redux Toolkit chosen over TanStack Query for this).
export function createResourceSlice(name) {
  return createSlice({
    name,
    initialState: { items: [], meta: null, current: null, status: 'idle', error: null },
    reducers: {
      requestStart(state) {
        state.status = 'loading';
        state.error = null;
      },
      requestFailed(state, action) {
        state.status = 'failed';
        state.error = action.payload;
      },
      listLoaded(state, action) {
        state.status = 'succeeded';
        state.items = action.payload.data;
        state.meta = action.payload.meta ?? null;
      },
      itemLoaded(state, action) {
        state.status = 'succeeded';
        state.current = action.payload;
      },
      itemUpserted(state, action) {
        const item = action.payload;
        const idx = state.items.findIndex((i) => i.id === item.id);
        if (idx >= 0) state.items[idx] = item;
        else state.items.unshift(item);
        state.current = item;
        state.status = 'succeeded';
      },
      itemRemoved(state, action) {
        state.items = state.items.filter((i) => i.id !== action.payload);
        state.status = 'succeeded';
      },
      currentCleared(state) {
        state.current = null;
      },
    },
  });
}
