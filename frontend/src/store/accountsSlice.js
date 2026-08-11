import { createResourceSlice } from './createResourceSlice';

const slice = createResourceSlice('accounts');
export const { requestStart, requestFailed, listLoaded, itemLoaded, itemUpserted, itemRemoved, currentCleared } =
  slice.actions;
export default slice.reducer;
