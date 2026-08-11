import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as authApi from '../api/auth';
import { setSession, clearSession, selectRoleType, selectIsAuthenticated } from '../store/authSlice';

export function useAuth() {
  const dispatch = useDispatch();
  const roleType = useSelector(selectRoleType);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const login = useCallback(
    async (email, password) => {
      const { accessToken } = await authApi.login(email, password);
      dispatch(setSession({ accessToken }));
    },
    [dispatch],
  );

  const logout = useCallback(() => {
    dispatch(clearSession());
  }, [dispatch]);

  return { roleType, isAuthenticated, login, logout };
}
