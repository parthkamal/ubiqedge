import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

// shared by every resource hook: dispatch requestStart, call the api/*.js
// function, dispatch the given success action with the result, or
// requestFailed with the error message. Keeps each resource hook down to
// just "which api function, which success action" instead of repeating
// this try/catch/dispatch shape 7+ times.
export function useAsyncDispatch(actions) {
  const dispatch = useDispatch();
  return useCallback(
    async (apiCall, onSuccess) => {
      dispatch(actions.requestStart());
      try {
        const result = await apiCall();
        dispatch(onSuccess(result));
        return result;
      } catch (err) {
        dispatch(actions.requestFailed(err.message));
        throw err;
      }
    },
    [dispatch, actions],
  );
}
