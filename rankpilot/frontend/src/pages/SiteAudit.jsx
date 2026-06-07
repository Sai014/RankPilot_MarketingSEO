import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import AiAnalysisPanel from '../components/AiAnalysisPanel';

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



  return (

    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-5xl mx-auto">

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">

        <div>

          <h2 className="text-xl sm:text-2xl font-bold text-white">Site Audit</h2>

          <p className="text-slate-400 mt-1">Crawl sitemaps to discover and track pages</p>

        </div>

        {hasDomains && (

          <DomainSelector value={domainId} onChange={setDomainId} disabled={domainsLoading} className="w-full sm:w-auto" />

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
              <AiAnalysisPanel
                title="AI Analysis"
                subtitle="Insights from your sitemap crawl"
                analysis={analysis}
                model={analysis.model}
              />
            )}

          </div>

        )}

      </section>



      <section className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl">

        <h3 className="text-sm font-semibold text-white">PageSpeed audits</h3>

        <p className="text-sm text-slate-400 mt-2">

          Run PageSpeed for individual pages from the{' '}

          <Link to="/pages" className="text-brand-400 hover:underline">

            Pages

          </Link>{' '}

          view — open any page&apos;s dashboard to audit mobile and desktop performance.

        </p>

      </section>

    </div>

  );

}



export default SiteAudit;

