import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as invoicesApi from '../api/invoices';
import * as accountsApi from '../api/accounts';
import * as invoicesActions from '../store/invoicesSlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function useInvoices() {
  const dispatch = useDispatch();
  const { items, meta, current, status, error } = useSelector((state) => state.invoices);
  const run = useAsyncDispatch(invoicesActions);

  const fetchList = useCallback(
    (params) => run(() => invoicesApi.listInvoices(params), invoicesActions.listLoaded),
    [run],
  );
  const fetchMine = useCallback(
    (params) => run(() => accountsApi.listMyInvoices(params), invoicesActions.listLoaded),
    [run],
  );
  const fetchOne = useCallback((id) => run(() => invoicesApi.getInvoice(id), invoicesActions.itemLoaded), [run]);
  // generate's response ({ generated, skipped, ... }) is a batch-run
  // summary, not an invoice — doesn't fit itemLoaded's "current invoice"
  // shape, so this bypasses `run` and returns the summary straight to the
  // caller (a page-local result banner) instead of writing it into `current`
  const generate = useCallback(
    async (body) => {
      dispatch(invoicesActions.requestStart());
      try {
        const result = await invoicesApi.generateInvoices(body);
        dispatch(invoicesActions.currentCleared());
        return result;
      } catch (err) {
        dispatch(invoicesActions.requestFailed(err.message));
        throw err;
      }
    },
    [dispatch],
  );
  const cancel = useCallback(
    (id) => run(() => invoicesApi.cancelInvoice(id), invoicesActions.itemUpserted),
    [run],
  );

  return { items, meta, current, status, error, fetchList, fetchMine, fetchOne, generate, cancel };
}
