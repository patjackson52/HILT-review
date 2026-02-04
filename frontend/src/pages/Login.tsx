import { useAuth } from '../contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import styles from './Login.module.css';

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: 'Your email domain is not allowed to access this application.',
  oauth_failed: 'Authentication failed. Please try again.',
};

export default function Login() {
  const { user, login, isLoading, isOAuthEnabled } = useAuth();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>HILT Review</h1>
        <p className={styles.subtitle}>Human-in-the-Loop Task Review</p>

        {error && (
          <div className={styles.error}>
            {ERROR_MESSAGES[error] || 'An error occurred during login.'}
          </div>
        )}

        <button className={styles.loginButton} onClick={login}>
          Sign in with Google
        </button>

        {!isOAuthEnabled && (
          <p className={styles.devNote}>
            OAuth is not configured. Using development mode authentication.
          </p>
        )}
      </div>
    </div>
  );
}
