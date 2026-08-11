import { createSlice } from '@reduxjs/toolkit';

// token persisted to localStorage so a refresh doesn't force a re-login.
// Deliberate tradeoff (reversed from the original in-memory-only design,
// see ubiqedge_tech_implementation_spec §8): a token in localStorage is
// readable by any injected script, i.e. exposed to XSS, for as long as it
// sits there (up to JWT_EXPIRES_IN, currently 8h) — accepted for this
// prototype's scope. The properly secure fix (httpOnly cookie + backend
// refresh-token support) is still out of scope, unchanged.
const STORAGE_KEY = 'ubiqedge_access_token';

function decodeJwt(token) {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

function isExpired(claims) {
  return typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now();
}

function loadPersistedSession() {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) return null;
  try {
    const claims = decodeJwt(token);
    if (isExpired(claims)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { accessToken: token, userId: claims.sub, orgId: claims.orgId, roleType: claims.roleType };
  } catch {
    // malformed value somehow ended up in storage — don't crash the app over it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const emptySession = {
  accessToken: null,
  userId: null,
  orgId: null,
  roleType: null, // 'Admin' | 'Customer'
};

const initialState = loadPersistedSession() ?? emptySession;

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      const { accessToken } = action.payload;
      const claims = decodeJwt(accessToken);
      state.accessToken = accessToken;
      state.userId = claims.sub;
      state.orgId = claims.orgId;
      state.roleType = claims.roleType;
      localStorage.setItem(STORAGE_KEY, accessToken);
    },
    clearSession() {
      localStorage.removeItem(STORAGE_KEY);
      return emptySession;
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;

export const selectAccessToken = (state) => state.auth.accessToken;
export const selectRoleType = (state) => state.auth.roleType;
export const selectIsAuthenticated = (state) => Boolean(state.auth.accessToken);
