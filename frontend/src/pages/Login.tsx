import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import styles from './Login.module.css';

export default function Login() {
  const { user, login, isLoading } = useAuth();

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
        <button className={styles.loginButton} onClick={login}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
