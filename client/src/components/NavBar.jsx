import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { initials } from '../services/constants.js';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark">SB</span>
          <span>Survey Builder</span>
        </Link>

        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/surveys">My Surveys</NavLink>
              <NavLink to="/surveys/new">Create</NavLink>
              <NavLink to="/profile">Profile</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}

          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {user && (
            <>
              <span className="row small muted" style={{ gap: '0.35rem' }}>
                <span
                  className="brand__mark"
                  style={{ width: 26, height: 26, fontSize: '0.7rem' }}
                >
                  {initials(user.name)}
                </span>
                {user.name}
              </span>
              <button type="button" className="btn btn--secondary btn--sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}