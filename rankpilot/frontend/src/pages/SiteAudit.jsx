import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import DomainSelector from '../components/DomainSelector';
import { useSelectedDomain } from '../components/DomainSelector';

function SiteAudit() {
  const { domains, domainId, setDomainId, hasDomains, loading: domainsLoading } = useSelectedDomain();
  const selectedDomain = domains.find((d) => d.id === domainId);

  const [siteUrl, setSiteUrl] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [analyze, setAnalyze] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const [psUrl, setPsUrl] = useState('');
  const [psStrategy, setPsStrategy] = useState('mobile');
  const [psLoading, setPsLoading] = useState(false);
  const [psResult, setPsResult] = useState(null);
  const [psAnalysis, setPsAnalysis] = useState(null);
  const [psSaveNotice, setPsSaveNotice] = useState(null);

  useEffect(() => {
    if (!selectedDomain?.domain || siteUrl) return;
    setSiteUrl(`https://${selectedDomain.domain}`);
  }, [selectedDomain?.domain, siteUrl]);

  async function handleCrawl(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis(null);
    try {
      const res = await api.crawlSitemap({ site_url: siteUrl, max_pages: maxPages, analyze });
      setResult(res.data);
      setAnalysis(res.analysis);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Crawl failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePageSpeed(e) {
    e.preventDefault();
    if (!domainId) {
      setError('Select a domain so PageSpeed results appear on the Dashboard.');
      return;
    }

    setPsLoading(true);
    setError(null);
    setPsResult(null);
    setPsAnalysis(null);
    setPsSaveNotice(null);
    try {
      const res = await api.auditPageSpeed({
        url: psUrl,
        strategy: psStrategy,
        analyze: true,
        domain_id: domainId,
      });
      setPsResult(res.data);
      setPsAnalysis(res.analysis);

      if (res.persisted) {
        setPsSaveNotice({ type: 'success', message: 'Saved to Dashboard for this domain.' });
      } else if (res.save_error) {
        setPsSaveNotice({ type: 'warning', message: `Audit complete but not saved: ${res.save_error}` });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'PageSpeed audit failed');
    } finally {
      setPsLoading(false);
    }
  }

  function scorePercent(score) {
    if (score == null) return '—';
    return `${Math.round(score * 100)}`;
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Site Audit</h2>
          <p className="text-slate-400 mt-1">Crawl sitemaps and run PageSpeed audits linked to your domain</p>
        </div>
        {hasDomains && (
          <DomainSelector value={domainId} onChange={setDomainId} disabled={domainsLoading} />
        )}
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <section className="mb-10">
        <h3 className="text-lg font-semibold text-white mb-4">Sitemap Crawl</h3>
        <form onSubmit={handleCrawl} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <input
            required
            placeholder="Site URL (e.g. https://example.com)"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-4 items-center">
            <label className="text-sm text-slate-400">
              Max pages:
              <input
                type="number"
                min={1}
                max={500}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="ml-2 w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} />
              AI analysis (Groq)
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {loading ? 'Crawling…' : 'Start Crawl'}
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-sm text-slate-400">URLs Found</p>
                <p className="text-2xl font-bold text-white">{result.total_urls}</p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-sm text-slate-400">Source</p>
                <p className="text-2xl font-bold text-brand-400 capitalize">{result.source}</p>
              </div>
            </div>

            {result.sample_pages?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="py-2 pr-4">URL</th>
                      <th className="py-2 pr-4">Title</th>
                      <th className="py-2">H1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sample_pages.map((page) => (
                      <tr key={page.url} className="border-b border-slate-800/50">
                        <td className="py-2 pr-4 text-brand-400 truncate max-w-xs">{page.url}</td>
                        <td className="py-2 pr-4 text-slate-300">{page.title || '—'}</td>
                        <td className="py-2 text-slate-400">{page.h1 || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analysis && (
              <div className="p-5 bg-slate-900 border border-brand-800/50 rounded-xl">
                <h4 className="text-sm font-semibold text-brand-300 mb-2">AI Analysis</h4>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{analysis.analysis}</pre>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-4">PageSpeed Insights</h3>
        {!domainsLoading && !hasDomains && (
          <div className="mb-4 p-4 bg-yellow-950/40 border border-yellow-800 rounded-lg text-yellow-200 text-sm">
            Add a domain first so PageSpeed scores appear on the Dashboard.
          </div>
        )}

        {psSaveNotice && (
          <div
            className={`mb-4 p-4 rounded-lg text-sm border ${
              psSaveNotice.type === 'success'
                ? 'bg-green-950/40 border-green-800 text-green-200'
                : 'bg-yellow-950/40 border-yellow-800 text-yellow-200'
            }`}
          >
            {psSaveNotice.message}
          </div>
        )}

        <form onSubmit={handlePageSpeed} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <input
            required
            placeholder="Page URL to audit"
            value={psUrl}
            onChange={(e) => setPsUrl(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={psStrategy}
            onChange={(e) => setPsStrategy(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
          <button
            type="submit"
            disabled={psLoading || !domainId}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {psLoading ? 'Running audit…' : 'Run PageSpeed Audit'}
          </button>
        </form>

        {psResult && (
          <div className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                ['Performance', psResult.metrics?.performance_score],
                ['SEO', psResult.metrics?.seo_score],
                ['Accessibility', psResult.metrics?.accessibility_score],
                ['Best Practices', psResult.metrics?.best_practices_score],
              ].map(([label, score]) => (
                <div key={label} className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-3xl font-bold text-white">{scorePercent(score)}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ['LCP', psResult.metrics?.largest_contentful_paint],
                ['CLS', psResult.metrics?.cumulative_layout_shift],
                ['TBT', psResult.metrics?.total_blocking_time],
                ['FCP', psResult.metrics?.first_contentful_paint],
                ['Speed Index', psResult.metrics?.speed_index],
                ['TTI', psResult.metrics?.interactive],
              ].map(([label, val]) => (
                <div key={label} className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                  <span className="text-slate-400">{label}: </span>
                  <span className="text-white">{val ?? '—'}</span>
                </div>
              ))}
            </div>
            {psAnalysis && (
              <div className="mt-4 p-5 bg-slate-900 border border-brand-800/50 rounded-xl">
                <h4 className="text-sm font-semibold text-brand-300 mb-2">AI Recommendations</h4>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{psAnalysis.analysis}</pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default SiteAudit;
