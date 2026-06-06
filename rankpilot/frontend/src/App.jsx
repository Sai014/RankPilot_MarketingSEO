import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Dashboard from './pages/Dashboard';
import Domains from './pages/Domains';
import PageInsights from './pages/PageInsights';
import SerpTracker from './pages/SerpTracker';
import SiteAudit from './pages/SiteAudit';
import Competitors from './pages/Competitors';
import Login from './pages/Login';
import Signup from './pages/Signup';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/domains', label: 'Domains' },
  { to: '/pages', label: 'Pages' },
  { to: '/audit', label: 'Site Audit' },
  { to: '/serp', label: 'SERP Tracker' },
  { to: '/competitors', label: 'Competitors' },
];

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-400 truncate max-w-[200px]">{user?.email}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 shrink-0 h-full flex flex-col overflow-y-auto bg-slate-900 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Rank<span className="text-brand-400">Pilot</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">SEO Intelligence Platform</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-300'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <p className="text-xs text-slate-600">Domain → Pages → Metrics</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        <header className="shrink-0 flex items-center justify-end px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <UserMenu />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/domains" element={<Domains />} />
            <Route path="/pages" element={<PageInsights />} />
            <Route path="/audit" element={<SiteAudit />} />
            <Route path="/serp" element={<SerpTracker />} />
            <Route path="/competitors" element={<Competitors />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
