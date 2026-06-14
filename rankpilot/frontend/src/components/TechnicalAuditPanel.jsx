import { scoreColor } from '../lib/dashboard';

function ScoreRing({ score, label, sublabel }) {
  const display =
    score == null ? null : score <= 1 ? Math.round(score * 100) : Math.round(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center ${
          display == null
            ? 'border-slate-700 text-slate-600'
            : display >= 90
              ? 'border-emerald-500/60 text-emerald-400'
              : display >= 50
                ? 'border-amber-500/60 text-amber-400'
                : 'border-red-500/60 text-red-400'
        }`}
      >
        <span className="text-lg font-bold tabular-nums">{display ?? '—'}</span>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function IssueList({ issues = [], title }) {
  if (!issues.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      <ul className="space-y-1.5">
        {issues.map((issue) => (
          <li key={issue} className="text-sm text-slate-300 flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            {issue}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TechnicalAuditPanel({ audit, domainAudit, pagespeed }) {
  if (!audit && !domainAudit) return null;

  const onpageSignals = audit?.onpage || {};
  const sslRow = domainAudit?.ssl;
  const headersRow = domainAudit?.security_headers;
  const ssl = sslRow?.result || (sslRow?.tls_version != null ? sslRow : null);
  const headers = headersRow?.result || (headersRow?.missing != null ? headersRow : null);

  const lighthouseMetric = (key) =>
    pagespeed?.mobile?.[key] ?? pagespeed?.desktop?.[key] ?? pagespeed?.[key] ?? null;

  const hasLighthouse = ['performance_score', 'seo_score', 'accessibility_score', 'best_practices_score'].some(
    (key) => lighthouseMetric(key) != null,
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Technical Audit</h3>
        <p className="text-sm text-slate-500 mt-0.5">On-page HTML, security headers, SSL, and Lighthouse scores</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <ScoreRing score={audit?.health_score} label="Health Score" sublabel="Composite" />
        <ScoreRing score={audit?.onpage_score} label="On-page SEO" />
        <ScoreRing score={lighthouseMetric('accessibility_score')} label="Accessibility" sublabel="Lighthouse" />
        <ScoreRing score={audit?.security_score ?? headersRow?.score} label="Security Headers" sublabel="Domain-wide" />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Lighthouse (PageSpeed Insights)</p>
        {hasLighthouse ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <ScoreRing score={lighthouseMetric('performance_score')} label="Performance" sublabel="Mobile preferred" />
            <ScoreRing score={lighthouseMetric('seo_score')} label="SEO" sublabel="Lighthouse" />
            <ScoreRing score={lighthouseMetric('accessibility_score')} label="Accessibility" sublabel="Lighthouse" />
            <ScoreRing score={lighthouseMetric('best_practices_score')} label="Best Practices" sublabel="Lighthouse" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No Lighthouse data yet — PageSpeed runs in the background after onboarding, or use the{' '}
            <span className="text-slate-400">Run audit</span> button in the PageSpeed panel above.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IssueList issues={audit?.onpage_issues} title="On-page issues" />

        {onpageSignals.title != null && (
          <div className="space-y-3 text-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">On-page signals</p>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Title length</dt>
                <dd className={`tabular-nums ${scoreColor(onpageSignals.title_length >= 30 && onpageSignals.title_length <= 60 ? 0.9 : 0.4)}`}>
                  {onpageSignals.title_length ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Word count</dt>
                <dd className="text-white tabular-nums">{onpageSignals.word_count ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Images w/o alt</dt>
                <dd className={`tabular-nums ${onpageSignals.images_without_alt ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {onpageSignals.images_without_alt ?? 0}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Schema markup</dt>
                <dd className={onpageSignals.has_schema_markup ? 'text-emerald-400' : 'text-slate-400'}>
                  {onpageSignals.has_schema_markup ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {domainAudit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-slate-800">
          {ssl && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">SSL / TLS</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Score</dt>
                  <dd className={`font-bold tabular-nums ${scoreColor((sslRow?.score ?? ssl.score ?? 0) / 100)}`}>
                    {sslRow?.score ?? ssl.score ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">TLS version</dt>
                  <dd className="text-white">{ssl.tls_version || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Cert expiry</dt>
                  <dd className="text-white tabular-nums">
                    {ssl.days_until_expiry != null ? `${ssl.days_until_expiry} days` : '—'}
                  </dd>
                </div>
              </dl>
              <IssueList issues={ssl.issues} title="SSL issues" />
            </div>
          )}

          {headers && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Security headers</p>
              <dl className="space-y-2 text-sm mb-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Score</dt>
                  <dd className={`font-bold tabular-nums ${scoreColor((headersRow?.score ?? headers.score ?? 0) / 100)}`}>
                    {headersRow?.score ?? headers.score ?? '—'}
                  </dd>
                </div>
              </dl>
              <IssueList issues={headers.missing?.map((h) => `Missing ${h}`)} title="Missing headers" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
