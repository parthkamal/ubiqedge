import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as devicesApi from '../api/devices';
import * as accountsApi from '../api/accounts';
import * as devicesActions from '../store/devicesSlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function useDevices() {
  const { items, meta, current, status, error } = useSelector((state) => state.devices);
  const run = useAsyncDispatch(devicesActions);

  const fetchList = useCallback(
    (params) => run(() => devicesApi.listDevices(params), devicesActions.listLoaded),
    [run],
  );
  const fetchOne = useCallback((id) => run(() => devicesApi.getDevice(id), devicesActions.itemLoaded), [run]);
  // GET /accounts/me/devices is a plain array (unpaginated — a customer's
  // own device count is inherently small, see api design), so it's wrapped
  // to match the { data, meta } shape listLoaded expects
  const fetchMine = useCallback(
    () => run(() => accountsApi.getMyDevices().then((data) => ({ data, meta: null })), devicesActions.listLoaded),
    [run],
  );
  const create = useCallback(
    (body) => run(() => devicesApi.createDevice(body), devicesActions.itemUpserted),
    [run],
  );
  const update = useCallback(
    (id, body) => run(() => devicesApi.updateDevice(id, body), devicesActions.itemUpserted),
    [run],
  );
  const remove = useCallback(
    (id) => run(() => devicesApi.deleteDevice(id), () => devicesActions.itemRemoved(id)),
    [run],
  );

  return { items, meta, current, status, error, fetchList, fetchOne, fetchMine, create, update, remove };
}
