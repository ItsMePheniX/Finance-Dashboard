import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { navItems } from '../data';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

const navToPath: Record<string, string> = {
  dashboard: '/dashboard',
  transactions: '/transactions',
  analytics: '/analytics',
  users: '/users',
  roles: '/roles',
};

const pathToNav: Record<string, string> = Object.fromEntries(
  Object.entries(navToPath).map(([k, v]) => [v, k])
);

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeNav = pathToNav[location.pathname] || 'dashboard';

  const handleNavChange = (id: string) => {
    navigate(navToPath[id] || '/dashboard');
  };

  const handleLogout = () => {
    void logout().finally(() => {
      navigate('/login');
    });
  };

  if (!user) return null;

  return (
    <div
      id="app-layout"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-dark)',
      }}
    >
      {/* Sidebar */}
      <Sidebar
        navItems={navItems}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main */}
      <main
        id="main-content"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
