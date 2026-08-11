import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as usersApi from '../api/users';
import * as usersActions from '../store/usersSlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function useUsers() {
  const { items, meta, current, status, error } = useSelector((state) => state.users);
  const run = useAsyncDispatch(usersActions);

  const fetchList = useCallback((params) => run(() => usersApi.listUsers(params), usersActions.listLoaded), [run]);
  const fetchOne = useCallback((id) => run(() => usersApi.getUser(id), usersActions.itemLoaded), [run]);
  const fetchMe = useCallback(() => run(() => usersApi.getMe(), usersActions.itemLoaded), [run]);
  const create = useCallback((body) => run(() => usersApi.createUser(body), usersActions.itemUpserted), [run]);
  const update = useCallback((id, body) => run(() => usersApi.updateUser(id, body), usersActions.itemUpserted), [run]);
  const remove = useCallback(
    (id) => run(() => usersApi.deleteUser(id), () => usersActions.itemRemoved(id)),
    [run],
  );

  return { items, meta, current, status, error, fetchList, fetchOne, fetchMe, create, update, remove };
}
