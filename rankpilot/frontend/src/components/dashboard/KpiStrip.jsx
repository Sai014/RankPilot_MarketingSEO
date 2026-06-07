import { formatCompact } from '../../lib/dashboard';

const icons = {
  position: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a1.125 1.125 0 001.591 0L21.75 9M21.75 9h-7.5V3" />
    </svg>
  ),
  clicks: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  leads: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  ranked: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0V9.375c0-.621-.504-1.125-1.125-1.125H9.622c-.621 0-1.125.504-1.125 1.125v3.75m0 0V6.375" />
    </svg>
  ),
};

const accents = {
  position: 'from-emerald-500/20 to-teal-600/5 border-emerald-500/20 text-emerald-400',
  clicks: 'from-violet-500/20 to-indigo-600/5 border-violet-500/20 text-violet-400',
  leads: 'from-amber-500/20 to-orange-600/5 border-amber-500/20 text-amber-400',
  ranked: 'from-brand-500/20 to-indigo-600/5 border-brand-500/20 text-brand-400',
};

export default function KpiStrip({ summary, gscLinked = false }) {
  if (!summary) return null;

  const cards = [
    {
      key: 'position',
      label: 'Avg. Position',
      value: summary.avg_position != null ? summary.avg_position : '—',
      sub: summary.ranked_pages
        ? `${summary.ranked_pages} ranked · ${summary.top_10_pages} in top 10`
        : 'Track keywords in SERP Tracker',
      accent: 'position',
    },
    {
      key: 'clicks',
      label: 'Organic Clicks',
      value: formatCompact(summary.total_clicks),
      sub: summary.pages_with_gsc
        ? 'From Google Search Console'
        : gscLinked
          ? 'Syncing GSC data…'
          : 'Connect via Google on Domains page',
      accent: 'clicks',
    },
    {
      key: 'leads',
      label: 'Leads Generated',
      value: formatCompact(summary.total_leads),
      sub: summary.total_leads ? 'Across tracked pages' : 'No lead data yet',
      accent: 'leads',
    },
    {
      key: 'ranked',
      label: 'Pages Ranked',
      value: `${summary.ranked_pages ?? 0}`,
      sub: `of ${summary.total_pages} total pages`,
      accent: 'ranked',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${accents[card.accent]}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</p>
              <p className="text-3xl font-bold text-white mt-2 tabular-nums">{card.value}</p>
              <p className="text-xs text-slate-500 mt-2">{card.sub}</p>
            </div>
            <div className={`p-2.5 rounded-xl bg-slate-900/60 ${accents[card.accent].split(' ').pop()}`}>
              {icons[card.key]}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
