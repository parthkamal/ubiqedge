import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as paymentsApi from '../api/payments';
import * as paymentsActions from '../store/paymentsSlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function usePayments() {
  const { items, current, status, error } = useSelector((state) => state.payments);
  const run = useAsyncDispatch(paymentsActions);

  // PaymentSessionResponseDto has transactionId, not id — itemUpserted's
  // list-merge assumes `.id`, so this uses itemLoaded (current-only) rather
  // than itemUpserted to avoid that mismatch
  const initiate = useCallback(
    (invoiceId) => run(() => paymentsApi.initiatePayment(invoiceId), paymentsActions.itemLoaded),
    [run],
  );
  const fetchForInvoice = useCallback(
    (invoiceId) =>
      run(
        () => paymentsApi.listInvoicePayments(invoiceId).then((data) => ({ data, meta: null })),
        paymentsActions.listLoaded,
      ),
    [run],
  );

  return { items, current, status, error, initiate, fetchForInvoice };
}
