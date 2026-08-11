import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Spinner from '@cloudscape-design/components/spinner';
import Box from '@cloudscape-design/components/box';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import { selectIsAuthenticated, selectRoleType } from './store/authSlice';
import { routesForRole, homePathByRole } from './routes/routeConfig';

function PageLoading() {
  return (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
    </Box>
  );
}

// only this role's routes ever get mounted into the tree — a Customer
// session literally cannot render an Admin page, typed-URL or not. See
// routeConfig.js and implementation spec §8.
function AuthenticatedApp() {
  const roleType = useSelector(selectRoleType);
  const myRoutes = routesForRole(roleType);
  const homePath = homePathByRole[roleType];

  return (
    <Layout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {myRoutes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <AuthenticatedApp />
      ) : (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
