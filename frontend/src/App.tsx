import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './pages/Layout';
import Login from './pages/Login';
import ReviewQueue from './pages/ReviewQueue';
import ReviewTask from './pages/ReviewTask';
import IntegrationSetup from './pages/IntegrationSetup';
import Archive from './pages/Archive';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ReviewQueue />} />
          <Route path="tasks/:id" element={<ReviewTask />} />
          <Route path="integrations" element={<IntegrationSetup />} />
          <Route path="archive" element={<Archive />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
