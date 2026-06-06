import { useState } from 'react';
import { api, ApiError } from '../api/client';

function Competitors() {
  const [mode, setMode] = useState('scrape');
  const [url, setUrl] = useState('');
  const [yourUrl, setYourUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  async function handleScrape(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis(null);
    try {
      const res = await api.scrapeCompetitor({ url, analyze: true });
      setResult(res.data);
      setAnalysis(res.analysis);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Scrape failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis(null);
    const urls = competitorUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    try {
      const res = await api.compareCompetitors({
        your_url: yourUrl,
        competitor_urls: urls,
        analyze: true,
      });
      setResult(res.data);
      setAnalysis(res.analysis);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  }

  function ScrapeCard({ data }) {
    if (data.error) {
      return (
        <div className="p-4 bg-red-950/30 border border-red-800 rounded-xl text-red-300 text-sm">
          {data.url}: {data.error}
        </div>
      );
    }
    return (
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline text-sm break-all">
          {data.url}
        </a>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Title Length" value={data.title_length} />
          <Stat label="Meta Desc" value={data.meta_description_length} />
          <Stat label="Word Count" value={data.word_count} />
          <Stat label="H1 Count" value={data.h1_tags?.length ?? 0} />
          <Stat label="Images" value={data.image_count} />
          <Stat label="Missing Alt" value={data.images_without_alt} />
          <Stat label="Internal Links" value={data.internal_link_count} />
          <Stat label="External Links" value={data.external_link_count} />
        </div>
        <div className="text-sm space-y-1">
          <p><span className="text-slate-500">Title:</span> <span className="text-white">{data.title || '—'}</span></p>
          <p><span className="text-slate-500">H1:</span> <span className="text-white">{data.h1_tags?.join(', ') || '—'}</span></p>
          <p>
            <span className="text-slate-500">Schema:</span>{' '}
            <span className={data.has_schema_markup ? 'text-green-400' : 'text-red-400'}>
              {data.has_schema_markup ? `Yes (${data.schema_count})` : 'No'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  function Stat({ label, value }) {
    return (
      <div className="p-2 bg-slate-800/50 rounded-lg">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-white">{value ?? '—'}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">Competitor Analysis</h2>
        <p className="text-slate-400 mt-1">Scrape on-page SEO signals from competitor pages</p>
      </header>

      <div className="flex gap-2 mb-6">
        {['scrape', 'compare'].map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setAnalysis(null); setError(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              mode === m
                ? 'bg-brand-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {m === 'scrape' ? 'Single Scrape' : 'Compare Sites'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {mode === 'scrape' ? (
        <form onSubmit={handleScrape} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 mb-8">
          <input
            required
            placeholder="Competitor URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {loading ? 'Scraping…' : 'Scrape Page'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCompare} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 mb-8">
          <input
            required
            placeholder="Your site URL"
            value={yourUrl}
            onChange={(e) => setYourUrl(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            required
            placeholder="Competitor URLs (one per line, max 5)"
            value={competitorUrls}
            onChange={(e) => setCompetitorUrls(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {loading ? 'Comparing…' : 'Compare Sites'}
          </button>
        </form>
      )}

      {result && mode === 'scrape' && (
        <div className="space-y-4">
          <ScrapeCard data={result} />
          {analysis && (
            <div className="p-5 bg-slate-900 border border-brand-800/50 rounded-xl">
              <h4 className="text-sm font-semibold text-brand-300 mb-2">AI Analysis</h4>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{analysis.analysis}</pre>
            </div>
          )}
        </div>
      )}

      {result && mode === 'compare' && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-slate-400">Your Site</h4>
          <ScrapeCard data={result.your_site} />
          <h4 className="text-sm font-semibold text-slate-400 mt-6">Competitors</h4>
          {result.competitors?.map((c, i) => (
            <ScrapeCard key={i} data={c} />
          ))}
          {analysis && (
            <div className="p-5 bg-slate-900 border border-brand-800/50 rounded-xl">
              <h4 className="text-sm font-semibold text-brand-300 mb-2">Competitive Gap Analysis</h4>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{analysis.analysis}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Competitors;
