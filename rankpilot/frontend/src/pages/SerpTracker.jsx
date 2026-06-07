import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import DomainSelector, { useSelectedDomain } from '../components/DomainSelector';
import AiAnalysisPanel from '../components/AiAnalysisPanel';
import { rankBadgeClass } from '../lib/dashboard';

function SerpTracker() {
  const { domains, domainId, setDomainId, hasDomains, loading: domainsLoading } = useSelectedDomain();
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('United States');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [saveNotice, setSaveNotice] = useState(null);

  const selectedDomain = domains.find((d) => d.id === domainId);

  useEffect(() => {
    if (!selectedDomain?.target_countries?.length) return;
    setLocation(selectedDomain.target_countries[0]);
  }, [selectedDomain?.id, selectedDomain?.target_countries]);

  async function handleTrack(e) {
    e.preventDefault();
    if (!domainId) {
      setError('Select a domain so results appear on the Dashboard.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSummary(null);
    setAnalysis(null);
    setAnalysisError(null);
    setSaveNotice(null);

    try {
      const res = await api.trackSerp({
        keyword: keyword.trim(),
        location,
        num: 100,
        domain_id: domainId,
        target_domain: selectedDomain?.domain,
        analyze: true,
      });
      setResult(res.data);
      setSummary(res.summary);
      setAnalysis(res.analysis);
      setAnalysisError(res.analysis_error || null);

      if (res.persisted) {
        setSaveNotice({ type: 'success', message: 'Saved to Dashboard for this domain.' });
      } else if (res.save_error) {
        setSaveNotice({ type: 'warning', message: `SERP fetched but not saved: ${res.save_error}` });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'SERP tracking failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">SERP Tracker</h2>
          <p className="text-slate-400 mt-1">
            Check where your site ranks for any keyword and get AI optimization tips
          </p>
        </div>
        {hasDomains && (
          <DomainSelector value={domainId} onChange={setDomainId} disabled={domainsLoading} className="w-full sm:w-auto" />
        )}
      </header>

      {!domainsLoading && !hasDomains && (
        <div className="mb-6 p-4 bg-yellow-950/40 border border-yellow-800 rounded-lg text-yellow-200 text-sm">
          Add a domain first (Domains page) so SERP tracks appear on the Dashboard.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {saveNotice && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm border ${
            saveNotice.type === 'success'
              ? 'bg-green-950/40 border-green-800 text-green-200'
              : 'bg-yellow-950/40 border-yellow-800 text-yellow-200'
          }`}
        >
          {saveNotice.message}
        </div>
      )}

      <form onSubmit={handleTrack} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 mb-8">
        <input
          required
          placeholder="Enter keyword to check ranking (e.g. ai marketing automation)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            readOnly
            value={selectedDomain?.domain || ''}
            placeholder="Select a domain"
            className="px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !domainId}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {loading ? 'Checking rank…' : 'Check Ranking'}
        </button>
      </form>

      {summary && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Keyword</p>
              <p className="text-white font-medium mt-1 line-clamp-2">{summary.keyword}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Your Rank</p>
              {summary.your_rank != null ? (
                <p className={`text-3xl font-bold mt-1 ${rankBadgeClass(summary.your_rank).split(' ').slice(1).join(' ')}`}>
                  #{summary.your_rank}
                </p>
              ) : (
                <p className="text-slate-500 text-sm mt-2">
                  Not in top {summary.results_checked || 100}
                </p>
              )}
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Results Checked</p>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">{summary.results_checked}</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Location</p>
              <p className="text-white text-sm mt-1">{summary.location}</p>
            </div>
          </div>

          {summary.your_listing && (
            <div className="mt-4 p-4 bg-brand-950/20 border border-brand-800/40 rounded-xl">
              <p className="text-xs text-brand-300 uppercase tracking-wide mb-1">Your listing</p>
              <p className="text-white font-medium">{summary.your_listing.title}</p>
              <p className="text-sm text-brand-400 mt-0.5 truncate">{summary.your_listing.url}</p>
              {summary.your_listing.snippet && (
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{summary.your_listing.snippet}</p>
              )}
            </div>
          )}

          {summary.top_competitors?.length > 0 && (
            <div className="mt-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top competitors in SERP</p>
              <div className="flex flex-wrap gap-2">
                {summary.top_competitors.map((d) => (
                  <span key={d} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {analysisError && (
        <div className="mb-6 p-4 rounded-lg text-sm border bg-yellow-950/40 border-yellow-800 text-yellow-200">
          Rank check succeeded, but AI tips failed: {analysisError}
        </div>
      )}

      {analysis && (
        <div className="mb-8">
            <AiAnalysisPanel
              analysis={analysis}
              model={analysis.model}
              title="AI Optimization Tips"
              subtitle="Actionable recommendations based on current SERP data"
            />
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">SERP Results</h3>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-400 bg-slate-900 border-b border-slate-800">
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Snippet</th>
                </tr>
              </thead>
              <tbody>
                {result.organic_results?.map((row) => {
                  const isYou =
                    summary?.target_domain &&
                    ((row.link || '').includes(summary.target_domain) ||
                      (row.domain || '').includes(summary.target_domain.replace('www.', '')));
                  return (
                    <tr
                      key={row.position}
                      className={`border-b border-slate-800/50 ${isYou ? 'bg-brand-950/30' : ''}`}
                    >
                      <td className="py-3 px-4 font-mono text-brand-400">{row.position}</td>
                      <td className="py-3 px-4">
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`hover:text-brand-300 ${isYou ? 'text-brand-200 font-medium' : 'text-white'}`}
                        >
                          {row.title}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{row.domain}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-md truncate">{row.snippet}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result.related_searches?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">Related Searches</h4>
              <div className="flex flex-wrap gap-2">
                {result.related_searches.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setKeyword(item.query || item)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-full transition-colors"
                  >
                    {item.query || item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SerpTracker;
