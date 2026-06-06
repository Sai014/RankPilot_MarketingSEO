import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Domains from './pages/Domains';
import PageInsights from './pages/PageInsights';
import SerpTracker from './pages/SerpTracker';

const navItems = [
  { to: '/domains', label: 'Domains' },
  { to: '/pages', label: 'Pages' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/serp', label: 'SERP Tracker' },
];
function App() {
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
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
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

      <main className="flex-1 h-full overflow-y-auto bg-slate-950">
        <Routes>
          <Route path="/" element={<Navigate to="/domains" replace />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/pages" element={<PageInsights />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/serp" element={<SerpTracker />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
