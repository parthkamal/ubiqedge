import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as devicesApi from '../api/devices';
import * as telemetryActions from '../store/telemetrySlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function useTelemetry() {
  const { items, meta, status, error } = useSelector((state) => state.telemetry);
  const run = useAsyncDispatch(telemetryActions);

  const fetchForDevice = useCallback(
    (deviceId, params) => run(() => devicesApi.getDeviceTelemetry(deviceId, params), telemetryActions.listLoaded),
    [run],
  );

  return { items, meta, status, error, fetchForDevice };
}
