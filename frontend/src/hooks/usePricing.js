import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as pricingApi from '../api/pricing';
import * as pricingActions from '../store/pricingSlice';
import { useAsyncDispatch } from './useAsyncDispatch';

export function usePricing() {
  const { items, meta, current, status, error } = useSelector((state) => state.pricing);
  const run = useAsyncDispatch(pricingActions);

  const fetchList = useCallback(
    (params) => run(() => pricingApi.listPricingConfigs(params), pricingActions.listLoaded),
    [run],
  );
  const fetchActive = useCallback(
    (type) => run(() => pricingApi.getActivePricingConfig(type), pricingActions.itemLoaded),
    [run],
  );
  const create = useCallback(
    (body) => run(() => pricingApi.createPricingConfig(body), pricingActions.itemUpserted),
    [run],
  );

  return { items, meta, current, status, error, fetchList, fetchActive, create };
}
