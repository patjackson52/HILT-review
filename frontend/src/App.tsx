import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './pages/Layout';
import Login from './pages/Login';
import ReviewQueue from './pages/ReviewQueue';
import ReviewTask from './pages/ReviewTask';

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
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
