import { useEffect, useState } from 'react';
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import SidebarProfile from './components/SidebarProfile';
import Dashboard from './pages/Dashboard';
import Domains from './pages/Domains';
import PageDetail from './pages/PageDetail';
import PageInsights from './pages/PageInsights';
import SerpTracker from './pages/SerpTracker';
import SiteAudit from './pages/SiteAudit';
import Competitors from './pages/Competitors';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true },
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

function SidebarContent({ onNavigate }) {
  return (
    <>
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
            onClick={onNavigate}
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
      <SidebarProfile />
    </>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full flex flex-col overflow-y-auto bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="lg:hidden flex items-center justify-end p-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <SidebarContent onNavigate={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">
            Rank<span className="text-brand-400">Pilot</span>
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/domains" element={<Domains />} />
            <Route path="/pages" element={<PageInsights />} />
            <Route path="/pages/:pageId" element={<PageDetail />} />
            <Route path="/audit" element={<SiteAudit />} />
            <Route path="/serp" element={<SerpTracker />} />
            <Route path="/competitors" element={<Competitors />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
        <Route path="/" element={<Landing />} />
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
