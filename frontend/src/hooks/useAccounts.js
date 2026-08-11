import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as accountsApi from '../api/accounts';
import * as accountsActions from '../store/accountsSlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function useAccounts() {
  const { items, meta, current, status, error } = useSelector((state) => state.accounts);
  const run = useAsyncDispatch(accountsActions);

  const fetchList = useCallback(
    (params) => run(() => accountsApi.listAccounts(params), accountsActions.listLoaded),
    [run],
  );
  const fetchOne = useCallback((id) => run(() => accountsApi.getAccount(id), accountsActions.itemLoaded), [run]);
  const fetchMine = useCallback(() => run(() => accountsApi.getMyAccount(), accountsActions.itemLoaded), [run]);
  const create = useCallback(
    (body) => run(() => accountsApi.createAccount(body), accountsActions.itemUpserted),
    [run],
  );
  const updateStatus = useCallback(
    (id, status) => run(() => accountsApi.updateAccountStatus(id, status), accountsActions.itemUpserted),
    [run],
  );

  return { items, meta, current, status, error, fetchList, fetchOne, fetchMine, create, updateStatus };
}
