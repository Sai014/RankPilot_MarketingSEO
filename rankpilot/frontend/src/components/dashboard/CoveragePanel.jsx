import { rankBadgeClass } from '../../lib/dashboard';

export default function CoveragePanel({ coverage = [], topRanked = [] }) {
  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-white">Signal Coverage</h3>
        <p className="text-xs text-slate-500 mt-0.5">Data completeness across your pages</p>
        <div className="mt-4 space-y-3">
          {coverage.map((item) => {
            const pct = item.total ? Math.round((item.value / item.total) * 100) : 0;
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-slate-300 tabular-nums">
                    {item.value}/{item.total} <span className="text-slate-600">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {topRanked.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Top Performers
          </h4>
          <ul className="space-y-2">
            {topRanked.map((item) => (
              <li key={item.path} className="flex items-center gap-3 text-sm">
                <span
                  className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${rankBadgeClass(item.rank)}`}
                >
                  {item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-200 truncate" title={item.keyword}>
                    {item.keyword}
                  </p>
                  <p className="text-xs text-slate-600 truncate font-mono">{item.path}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
