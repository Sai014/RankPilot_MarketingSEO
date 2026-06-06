import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

export default function DomainSelector({ value, onChange, className = '', disabled = false }) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listDomains()
      .then((res) => setDomains(res.data || []))
      .catch(() => setDomains([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <select
        disabled
        className={`px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-500 ${className}`}
      >
        <option>Loading domains…</option>
      </select>
    );
  }

  if (domains.length === 0) {
    return null;
  }

  return (
    <select
      value={value || domains[0]?.id || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 ${className}`}
    >
      {domains.map((d) => (
        <option key={d.id} value={d.id}>
          {d.display_name || d.domain}
        </option>
      ))}
    </select>
  );
}

export function useDomains() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    return api
      .listDomains()
      .then((res) => setDomains(res.data || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load domains'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  return { domains, loading, error, reload };
}

/** Load domains and auto-select the first one when available. */
export function useSelectedDomain() {
  const { domains, loading, error, reload } = useDomains();
  const [domainId, setDomainId] = useState('');

  useEffect(() => {
    if (loading) return;
    if (domains.length === 0) {
      setDomainId('');
      return;
    }
    setDomainId((prev) => {
      if (prev && domains.some((d) => d.id === prev)) return prev;
      return domains[0].id;
    });
  }, [domains, loading]);

  return {
    domains,
    domainId,
    setDomainId,
    loading,
    error,
    reload,
    hasDomains: domains.length > 0,
  };
}
