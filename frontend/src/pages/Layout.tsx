import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          HILT Review
        </Link>
        <nav className={styles.nav}>
          <Link to="/" className={styles.navLink}>Queue</Link>
          <Link to="/integrations" className={styles.navLink}>Integrations</Link>
        </nav>
        <div className={styles.userMenu}>
          {user && (
            <>
              <span className={styles.userName}>{user.name}</span>
              <button onClick={logout} className={styles.logoutButton}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
