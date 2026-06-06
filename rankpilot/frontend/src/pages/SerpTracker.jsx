import { useEffect, useState } from 'react';

import { api, ApiError } from '../api/client';

import DomainSelector from '../components/DomainSelector';

import { useSelectedDomain } from '../components/DomainSelector';



function SerpTracker() {

  const { domains, domainId, setDomainId, hasDomains, loading: domainsLoading } = useSelectedDomain();

  const [keyword, setKeyword] = useState('');

  const [location, setLocation] = useState('United States');

  const [targetDomain, setTargetDomain] = useState('');

  const [targetDomainTouched, setTargetDomainTouched] = useState(false);

  const [analyze, setAnalyze] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [result, setResult] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const [saveNotice, setSaveNotice] = useState(null);



  const selectedDomain = domains.find((d) => d.id === domainId);



  useEffect(() => {

    if (targetDomainTouched || !selectedDomain?.domain) return;

    setTargetDomain(selectedDomain.domain);

  }, [selectedDomain?.domain, targetDomainTouched]);



  async function handleTrack(e) {

    e.preventDefault();

    if (!domainId) {

      setError('Select a domain so results appear on the Dashboard.');

      return;

    }



    setLoading(true);

    setError(null);

    setResult(null);

    setAnalysis(null);
    setAnalysisError(null);
    setSaveNotice(null);

    try {

      const payload = {

        keyword,

        location,

        analyze,

        num: 100,

        domain_id: domainId,

      };

      if (targetDomain.trim()) {

        payload.target_domain = targetDomain.trim();

      }

      const res = await api.trackSerp(payload);

      setResult(res.data);
      setAnalysis(res.analysis);
      setAnalysisError(res.analysis_error || null);

      if (res.persisted) {

        setSaveNotice({ type: 'success', message: 'Saved to Dashboard for this domain.' });

      } else if (res.save_error) {

        setSaveNotice({ type: 'warning', message: `SERP fetched but not saved: ${res.save_error}` });

      } else {

        setSaveNotice({

          type: 'warning',

          message: 'SERP fetched but not linked to a domain — select a domain to save results.',

        });

      }

    } catch (err) {

      setError(err instanceof ApiError ? err.message : 'SERP tracking failed');

    } finally {

      setLoading(false);

    }

  }



  return (

    <div className="p-8 max-w-5xl">

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">

        <div>

          <h2 className="text-2xl font-bold text-white">SERP Tracker</h2>

          <p className="text-slate-400 mt-1">

            Track keyword rankings via ValueSERP — results save to the Dashboard for the selected domain

          </p>

        </div>

        {hasDomains && (

          <DomainSelector value={domainId} onChange={setDomainId} disabled={domainsLoading} />

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

      {analysisError && (
        <div className="mb-6 p-4 rounded-lg text-sm border bg-yellow-950/40 border-yellow-800 text-yellow-200">
          SERP saved successfully, but AI analysis failed: {analysisError}
        </div>
      )}

      <form onSubmit={handleTrack} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 mb-8">

        <input

          required

          placeholder="Target keyword"

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

            placeholder="Your domain (auto-filled from selected domain)"

            value={targetDomain}

            onChange={(e) => {

              setTargetDomainTouched(true);

              setTargetDomain(e.target.value);

            }}

            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"

          />

        </div>

        <label className="flex items-center gap-2 text-sm text-slate-400">

          <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} />

          AI SERP analysis (Groq)

        </label>

        <button

          type="submit"

          disabled={loading || !domainId}

          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"

        >

          {loading ? 'Fetching SERP…' : 'Track Keyword'}

        </button>

      </form>



      {result && (

        <div className="space-y-6">

          <div className="flex flex-wrap gap-4">

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">

              <p className="text-sm text-slate-400">Keyword</p>

              <p className="text-lg font-semibold text-white">{result.keyword}</p>

            </div>

            {result.target_rank != null && (

              <div className="p-4 bg-brand-950/50 border border-brand-800 rounded-xl">

                <p className="text-sm text-brand-300">Your Rank</p>

                <p className="text-3xl font-bold text-brand-400">#{result.target_rank}</p>

              </div>

            )}

            {result.target_rank == null && result.target_domain && (

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">

                <p className="text-sm text-slate-400">Your Rank</p>

                <p className="text-lg text-slate-500">Not in top {result.organic_results?.length || 100}</p>

              </div>

            )}

          </div>



          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="text-left text-slate-400 border-b border-slate-800">

                  <th className="py-2 pr-4 w-12">#</th>

                  <th className="py-2 pr-4">Title</th>

                  <th className="py-2 pr-4">Domain</th>

                  <th className="py-2">Snippet</th>

                </tr>

              </thead>

              <tbody>

                {result.organic_results?.map((row) => (

                  <tr key={row.position} className="border-b border-slate-800/50">

                    <td className="py-3 pr-4 font-mono text-brand-400">{row.position}</td>

                    <td className="py-3 pr-4">

                      <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-white hover:text-brand-300">

                        {row.title}

                      </a>

                    </td>

                    <td className="py-3 pr-4 text-slate-400">{row.domain}</td>

                    <td className="py-3 text-slate-500 truncate max-w-md">{row.snippet}</td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>



          {result.related_searches?.length > 0 && (

            <div>

              <h4 className="text-sm font-semibold text-slate-400 mb-2">Related Searches</h4>

              <div className="flex flex-wrap gap-2">

                {result.related_searches.map((item, i) => (

                  <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full">

                    {item.query || item}

                  </span>

                ))}

              </div>

            </div>

          )}



          {analysis && (

            <div className="p-5 bg-slate-900 border border-brand-800/50 rounded-xl">

              <h4 className="text-sm font-semibold text-brand-300 mb-2">AI SERP Analysis</h4>

              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{analysis.analysis}</pre>

            </div>

          )}

        </div>

      )}

    </div>

  );

}



export default SerpTracker;

