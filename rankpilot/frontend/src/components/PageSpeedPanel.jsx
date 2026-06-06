import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { scoreColor, scorePct } from '../lib/dashboard';

function ScoreCard({ label, score }) {
  const pct = scorePct(score);
  return (
    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${scoreColor(pct ?? 0)}`}>
        {pct != null ? pct : '—'}
      </p>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-sm">
      <span className="text-slate-400">{label}: </span>
      <span className="text-white">{value ?? '—'}</span>
    </div>
  );
}

export default function PageSpeedPanel({
  pageId,
  domainId,
  url,
  pagespeed,
  onUpdated,
}) {
  const [strategy, setStrategy] = useState('mobile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [liveResult, setLiveResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const mobile = pagespeed?.mobile;
  const desktop = pagespeed?.desktop;
  const active = strategy === 'desktop' ? desktop : mobile;
  const displayMetrics = liveResult?.metrics || active;

  async function handleAudit(e) {
    e.preventDefault();
    if (!domainId || !url) return;

    setLoading(true);
    setError(null);
    setNotice(null);
    setLiveResult(null);
    setAnalysis(null);

    try {
      const res = await api.auditPageSpeed({
        url,
        strategy,
        analyze: true,
        domain_id: domainId,
        page_id: pageId,
      });
      setLiveResult(res.data);
      setAnalysis(res.analysis);
      if (res.persisted) {
        setNotice({ type: 'success', message: 'Audit saved for this page.' });
        onUpdated?.();
      } else if (res.save_error) {
        setNotice({ type: 'warning', message: `Audit complete but not saved: ${res.save_error}` });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'PageSpeed audit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">PageSpeed Insights</h3>
          <p className="text-sm text-slate-500 mt-0.5">Performance scores for this page</p>
        </div>
        <div className="flex gap-2">
          {[
            ['mobile', 'Mobile', mobile?.performance_score],
            ['desktop', 'Desktop', desktop?.performance_score],
          ].map(([key, label, score]) => {
            const pct = scorePct(score);
            const isActive = strategy === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStrategy(key)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  isActive
                    ? 'border-brand-500/50 bg-brand-500/10 text-brand-200'
                    : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {label}
                {pct != null && (
                  <span className={`ml-2 font-mono font-semibold ${scoreColor(pct)}`}>{pct}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {notice && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm border ${
            notice.type === 'success'
              ? 'bg-green-950/40 border-green-800 text-green-200'
              : 'bg-yellow-950/40 border-yellow-800 text-yellow-200'
          }`}
        >
          {notice.message}
        </div>
      )}

      {displayMetrics ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <ScoreCard label="Performance" score={displayMetrics.performance_score} />
            <ScoreCard label="SEO" score={displayMetrics.seo_score} />
            <ScoreCard label="Accessibility" score={displayMetrics.accessibility_score} />
            <ScoreCard label="Best Practices" score={displayMetrics.best_practices_score} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricRow label="LCP" value={displayMetrics.largest_contentful_paint} />
            <MetricRow label="CLS" value={displayMetrics.cumulative_layout_shift} />
            <MetricRow label="TBT" value={displayMetrics.total_blocking_time} />
            <MetricRow label="FCP" value={displayMetrics.first_contentful_paint} />
            <MetricRow label="Speed Index" value={displayMetrics.speed_index} />
            <MetricRow label="TTI" value={displayMetrics.interactive} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500 mb-4">No PageSpeed data yet for {strategy}.</p>
      )}

      <form onSubmit={handleAudit} className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
        >
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
        </select>
        <button
          type="submit"
          disabled={loading || !domainId}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {loading ? 'Running audit…' : `Run ${strategy} audit`}
        </button>
        {active?.audited_at && !liveResult && (
          <span className="text-xs text-slate-500">
            Last audited {new Date(active.audited_at).toLocaleString()}
          </span>
        )}
      </form>

      {analysis && (
        <div className="mt-6 p-5 bg-slate-950/60 border border-brand-800/50 rounded-xl">
          <h4 className="text-sm font-semibold text-brand-300 mb-2">AI Recommendations</h4>
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{analysis.analysis}</pre>
        </div>
      )}
    </div>
  );
}
