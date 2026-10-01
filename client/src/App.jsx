import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import NavBar from './components/NavBar.jsx';
import { Loader } from './components/ui.jsx';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SurveyListPage from './pages/SurveyListPage.jsx';
import CreateSurveyPage from './pages/CreateSurveyPage.jsx';
import SurveyBuilderPage from './pages/SurveyBuilderPage.jsx';
import SurveyResultsPage from './pages/SurveyResultsPage.jsx';
import RespondPage from './pages/RespondPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Owner pages get the navigation bar; the public response page does not. */
function OwnerLayout({ children }) {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">{children}</main>
    </div>
  );
}

function OwnerRoute({ children }) {
  return (
    <RequireAuth>
      <OwnerLayout>{children}</OwnerLayout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/s/:token" element={<RespondPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Authenticated */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<OwnerRoute><DashboardPage /></OwnerRoute>} />
            <Route path="/surveys" element={<OwnerRoute><SurveyListPage /></OwnerRoute>} />
            <Route path="/surveys/new" element={<OwnerRoute><CreateSurveyPage /></OwnerRoute>} />
            <Route
              path="/surveys/:id"
              element={<OwnerRoute><SurveyResultsPage /></OwnerRoute>}
            />
            <Route
              path="/surveys/:id/edit"
              element={<OwnerRoute><SurveyBuilderPage /></OwnerRoute>}
            />
            <Route path="/profile" element={<OwnerRoute><ProfilePage /></OwnerRoute>} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}