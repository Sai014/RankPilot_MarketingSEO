import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useMousePosition } from '../hooks/useMousePosition';
import { useInView } from '../hooks/useInView';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function CursorGlow({ x, y }) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(700px circle at ${x}px ${y}px, rgba(99, 102, 241, 0.12), transparent 45%)`,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(400px circle at ${x}px ${y}px, rgba(168, 85, 247, 0.08), transparent 40%)`,
        }}
      />
    </>
  );
}

function ParallaxGrid({ px, py }) {
  const offsetX = (px - 0.5) * 30;
  const offsetY = (py - 0.5) * 30;

  return (
    <div
      className="pointer-events-none fixed inset-0 landing-grid opacity-40 transition-transform duration-200 ease-out"
      style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
    />
  );
}

function Reveal({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function TiltCard({ children, className = '', glowColor = 'brand' }) {
  const ref = useRef(null);
  const [transform, setTransform] = useState('');
  const [glare, setGlare] = useState({ x: 50, y: 50 });

  function handleMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(8px)`
    );
    setGlare({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  function handleLeave() {
    setTransform('perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0px)');
    setGlare({ x: 50, y: 50 });
  }

  const glowMap = {
    brand: 'rgba(99, 102, 241, 0.15)',
    emerald: 'rgba(52, 211, 153, 0.15)',
    purple: 'rgba(168, 85, 247, 0.15)',
    amber: 'rgba(251, 191, 36, 0.15)',
    blue: 'rgba(59, 130, 246, 0.15)',
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`group relative ${className}`}
      style={{
        transform,
        transition: transform.includes('0deg') ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.1s ease-out',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, ${glowMap[glowColor] || glowMap.brand}, transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

function MagneticButton({ to, href, children, className = '', variant = 'primary' }) {
  const ref = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function handleMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setOffset({ x: x * 0.2, y: y * 0.2 });
  }

  function handleLeave() {
    setOffset({ x: 0, y: 0 });
  }

  const style = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    transition: offset.x === 0 ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.15s ease-out',
  };

  const baseClass =
    variant === 'primary'
      ? 'btn-gradient px-8 py-3.5 inline-flex items-center gap-2 group'
      : 'rounded-xl border border-slate-700/80 bg-slate-900/50 backdrop-blur-sm hover:border-brand-500/40 hover:bg-slate-800/60 text-slate-300 font-medium px-8 py-3.5 inline-flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/10';

  const inner = (
    <span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={style}
      className={`${baseClass} ${className}`}
    >
      {children}
      {variant === 'primary' && (
        <svg
          className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      )}
    </span>
  );

  if (to) return <Link to={to}>{inner}</Link>;
  if (href) return <a href={href}>{inner}</a>;
  return inner;
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="relative text-sm text-slate-400 hover:text-white transition-colors duration-300 group"
    >
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-px bg-gradient-to-r from-brand-400 to-purple-400 transition-all duration-300 group-hover:w-full" />
    </a>
  );
}

const features = [
  {
    title: 'SERP rank tracking',
    description:
      'Monitor every keyword that drives your business — across locations, devices, and time.',
    glowColor: 'brand',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: 'AI strategy assistant',
    description:
      'Get plain-English recommendations on what to optimize, write, or refresh next.',
    glowColor: 'purple',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    title: 'Page speed audits',
    description:
      'Catch Core Web Vitals issues before they tank your rankings or conversions.',
    glowColor: 'amber',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: 'Competitor intelligence',
    description:
      "See exactly what's working for your rivals — content, keywords, and gaps you can win.",
    glowColor: 'blue',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Sitemap crawling',
    description:
      'Discover broken links, thin content, and hidden technical debt across your whole site.',
    glowColor: 'emerald',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    title: 'Marketing-ready reports',
    description:
      'Share insights stakeholders actually understand — no SEO jargon, just outcomes.',
    glowColor: 'brand',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

const stats = [
  {
    label: 'Avg. position',
    value: '↑ 4.2',
    sub: 'across tracked keywords',
    color: 'text-emerald-400',
    glowColor: 'emerald',
    icon: (
      <svg className="w-5 h-5 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    label: 'Organic clicks',
    value: '+38%',
    sub: 'month over month',
    color: 'text-purple-400',
    glowColor: 'purple',
    icon: (
      <svg className="w-5 h-5 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    label: 'Leads generated',
    value: '1.2k',
    sub: 'from SEO this quarter',
    color: 'text-amber-400',
    glowColor: 'amber',
    icon: (
      <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    label: 'Pages ranked',
    value: '284',
    sub: 'in Google top 10',
    color: 'text-blue-400',
    glowColor: 'blue',
    icon: (
      <svg className="w-5 h-5 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
];

const steps = [
  {
    num: '01',
    title: 'Add your site',
    description:
      'Drop in your domain and key competitors. RankPilot crawls and indexes everything in minutes.',
  },
  {
    num: '02',
    title: 'Let AI analyze',
    description:
      'Our AI scans rankings, pages, and competitor moves to surface the opportunities that matter.',
  },
  {
    num: '03',
    title: 'Ship the wins',
    description:
      'Get a prioritized action list your team can execute this week — not next quarter.',
  },
];

const serpRows = [
  { rank: 3, domain: 'yourbrand.com', change: '+4', up: true },
  { rank: 7, domain: 'competitor.io', change: '-2', up: false },
  { rank: 12, domain: 'anothersite.com', change: '+1', up: true },
];

function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const mouse = useMousePosition();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredSerp, setHoveredSerp] = useState(null);

  useEffect(() => {
    setMounted(true);
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) return <Spinner />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <ParallaxGrid px={mouse.px} py={mouse.py} />
      <CursorGlow x={mouse.x} y={mouse.y} />

      {/* Ambient orbs */}
      <div
        className="pointer-events-none fixed top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl animate-float"
        style={{ transform: `translate(${(mouse.px - 0.5) * -40}px, ${(mouse.py - 0.5) * -40}px)` }}
      />
      <div
        className="pointer-events-none fixed bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-float-delayed"
        style={{ transform: `translate(${(mouse.px - 0.5) * 30}px, ${(mouse.py - 0.5) * 30}px)` }}
      />

      {/* Navigation */}
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shadow-lg shadow-black/20 py-3'
            : 'border-b border-transparent bg-transparent py-5'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold tracking-tight text-white transition-transform duration-300 hover:scale-105"
          >
            Rank<span className="text-brand-400">Pilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How it works</NavLink>
            <NavLink href="#google-search">Google Search</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline text-sm text-slate-400 hover:text-white transition-all duration-300 hover:scale-105"
            >
              Sign in
            </Link>
            <MagneticButton to="/signup" className="text-sm px-5 py-2.5">
              Get started
            </MagneticButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/25 via-transparent to-slate-950 pointer-events-none" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none transition-transform duration-300"
          style={{
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)',
            transform: `translate(calc(-50% + ${(mouse.px - 0.5) * 60}px), ${(mouse.py - 0.5) * 40}px)`,
          }}
        />

        <div className="max-w-6xl mx-auto px-6 pt-16 pb-8 text-center relative z-10">
          <h1
            className={`text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight transition-all duration-1000 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <span className="gradient-text">SEO intelligence that</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-purple-300 to-pink-300">
              thinks like your team
            </span>
          </h1>

          <p
            className={`mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed transition-all duration-1000 delay-200 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            RankPilot helps marketing teams discover ranking opportunities, audit pages, and
            outsmart competitors — with AI that turns raw SEO data into actionable strategy.
          </p>

          <div
            className={`mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <MagneticButton to="/signup">Get started free</MagneticButton>
            <MagneticButton href="#features" variant="secondary">
              See what it does
            </MagneticButton>
          </div>

          <div
            className={`mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 transition-all duration-1000 delay-500 ${
              mounted ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {['Free to start', 'No credit card', 'AI insights'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Stats cards — overlapping hero */}
        <div className="max-w-5xl mx-auto px-6 pb-20 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <TiltCard glowColor={stat.glowColor} className="group h-full">
                  <div className="glass-card p-5 h-full group-hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-3">
                      <p className={`text-[10px] uppercase tracking-widest font-semibold ${stat.color}`}>
                        {stat.label}
                      </p>
                      {stat.icon}
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{stat.sub}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 relative z-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-sm text-brand-400 font-medium mb-3">Everything in one cockpit</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Marketing-grade SEO,
              <br />
              <span className="text-slate-400">minus the spreadsheets</span>
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Stop juggling six tools. RankPilot unifies ranking, technical health, and competitive
              intel — then lets AI tell you what to do next.
            </p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80}>
              <TiltCard glowColor={feature.glowColor} className="group h-full">
                <div className="glass-card p-6 h-full group-hover:-translate-y-1">
                  <div className="w-10 h-10 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-brand-500/30 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-brand-500/20">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 group-hover:text-brand-200 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Google Search Integration */}
      <section id="google-search" className="border-y border-slate-800/40 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950/30 via-slate-900/50 to-purple-950/30 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-24 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div>
                <p className="text-sm text-brand-400 font-medium mb-3 flex items-center gap-2">
                  <GoogleIcon />
                  Google Search integration
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                  Real Google rankings.
                  <br />
                  <span className="text-slate-400">Real time.</span>
                </h2>
                <p className="mt-4 text-slate-400 leading-relaxed">
                  Connect Google Search Console and track exactly where your pages land on Google for
                  every keyword that matters. Watch movement day by day, catch drops before they hurt,
                  and prove the impact of every content push.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    'Live SERP tracking across locations & devices',
                    'Spot keyword opportunities your competitors are winning',
                    'AI explains why rankings moved — and what to do',
                  ].map((item, i) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-slate-300 group cursor-default"
                    >
                      <span className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 group-hover:bg-brand-500/40 group-hover:scale-110">
                        <svg className="w-3 h-3 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="transition-colors duration-300 group-hover:text-white">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <TiltCard glowColor="brand" className="group">
                <div className="glass-card p-6 shadow-2xl shadow-black/40 group-hover:-translate-y-1">
                  <div className="flex items-center gap-2 mb-4">
                    <GoogleIcon />
                    <span className="text-sm text-slate-400">&quot;best running shoes 2026&quot;</span>
                    <span className="text-xs text-slate-600 ml-auto">Google · US</span>
                  </div>
                  <div className="space-y-3">
                    {serpRows.map((row) => (
                      <div
                        key={row.domain}
                        onMouseEnter={() => setHoveredSerp(row.rank)}
                        onMouseLeave={() => setHoveredSerp(null)}
                        className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-all duration-300 cursor-default ${
                          hoveredSerp === row.rank
                            ? 'bg-brand-950/60 border-brand-500/40 scale-[1.02] shadow-lg shadow-brand-500/10'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`text-lg font-bold w-8 transition-colors duration-300 ${
                            hoveredSerp === row.rank ? 'text-brand-300' : 'text-brand-400'
                          }`}
                        >
                          #{row.rank}
                        </span>
                        <span className="text-sm text-slate-300 flex-1">{row.domain}</span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full transition-all duration-300 ${
                            row.up
                              ? 'text-emerald-400 bg-emerald-400/10'
                              : 'text-red-400 bg-red-400/10'
                          }`}
                        >
                          {row.change}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg bg-brand-950/40 border border-brand-900/50 px-4 py-3 transition-all duration-300 hover:border-brand-500/30 hover:bg-brand-950/60">
                    <p className="text-xs text-brand-300 leading-relaxed">
                      <span className="font-semibold text-brand-200">AI insight:</span> Your jump to #3
                      correlates with last week&apos;s content refresh — replicate this on 4 similar pages.
                    </p>
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24 relative z-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-sm text-brand-400 font-medium mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              From data to decisions in minutes
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <Reveal key={step.num} delay={i * 120}>
              <div className="group relative p-6 rounded-2xl border border-transparent hover:border-slate-800 hover:bg-slate-900/30 transition-all duration-500 cursor-default">
                <span className="text-5xl font-bold text-slate-800 group-hover:text-brand-900 transition-colors duration-500">
                  {step.num}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-brand-200 transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors duration-300">
                  {step.description}
                </p>
                <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-brand-500/0 to-transparent group-hover:via-brand-500/50 transition-all duration-500" />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-slate-800/40 relative z-10">
        <div
          className="absolute inset-0 pointer-events-none transition-transform duration-500"
          style={{
            background: `radial-gradient(ellipse at ${mouse.px * 100}% 50%, rgba(99,102,241,0.15), transparent 60%)`,
          }}
        />
        <Reveal>
          <div className="max-w-6xl mx-auto px-6 py-24 text-center relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white max-w-2xl mx-auto">
              Give your marketing team an{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-purple-300">
                unfair SEO advantage
              </span>
            </h2>
            <p className="mt-4 text-slate-400">
              Free to start. Sign up in 30 seconds and run your first AI audit today.
            </p>
            <div className="mt-8">
              <MagneticButton to="/signup">Get started</MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 bg-slate-900/20 relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to="/"
            className="text-xl font-bold tracking-tight text-white transition-transform duration-300 hover:scale-105"
          >
            Rank<span className="text-brand-400">Pilot</span>
          </Link>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} RankPilot. Built for marketers who move fast.
          </p>
        </div>
      </footer>
    </div>
  );
}
