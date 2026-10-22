import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SecretsPage } from './pages/SecretsPage';
import { SecretDetailPage } from './pages/SecretDetailPage';
import { AccessPage } from './pages/AccessPage';
import { AuditPage } from './pages/AuditPage';

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/secrets" element={<SecretsPage />} />
        <Route path="/secrets/:id" element={<SecretDetailPage />} />
        <Route path="/access" element={<AccessPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/secrets" replace />} />
    </Routes>
  );
}
