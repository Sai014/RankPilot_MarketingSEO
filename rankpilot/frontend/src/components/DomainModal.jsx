import { useEffect, useRef, useState } from 'react';
import { TARGET_COUNTRIES } from '../lib/domains';

function GlobeIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.264.26-2.467.732-3.559" />
    </svg>
  );
}

function CountryMultiSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(country) {
    if (value.includes(country)) {
      onChange(value.filter((c) => c !== country));
    } else {
      onChange([...value, country]);
    }
  }

  const label = value.length === 0 ? 'Select countries…' : `${value.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-left hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
      >
        <span className={value.length ? 'text-white' : 'text-slate-500'}>{label}</span>
        <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
          {TARGET_COUNTRIES.map((country) => (
            <label
              key={country}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(country)}
                onChange={() => toggle(country)}
                className="rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
              />
              {country}
            </label>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-600/20 text-brand-300 text-xs rounded-full">
              {c}
              <button type="button" onClick={() => toggle(c)} className="hover:text-brand-200">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DomainModal({ open, onClose, onSubmit, submitting, initial, mode = 'add' }) {
  const [displayName, setDisplayName] = useState('');
  const [domain, setDomain] = useState('');
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    if (open) {
      setDisplayName(initial?.display_name || '');
      setDomain(initial?.domain || '');
      setCountries(initial?.target_countries || []);
    }
  }, [open, initial]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit({
      display_name: displayName.trim(),
      domain: domain.trim(),
      target_countries: countries,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === 'edit' ? 'Edit Domain' : 'Add New Domain'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'edit'
                ? 'Update display name and default target countries.'
                : 'Add a website to track. We auto-detect pages from the sitemap.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Display Name</label>
            <input
              required
              placeholder="e.g., Main Website"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Domain</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <GlobeIcon />
              </span>
              <input
                required
                disabled={mode === 'edit'}
                placeholder="yoursite.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Default Target Countries</label>
            <p className="text-xs text-slate-500 mb-2">
              All pages will be tracked for these countries by default
            </p>
            <CountryMultiSelect value={countries} onChange={setCountries} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 disabled:opacity-50 min-w-[120px]"
            >
              {submitting ? (mode === 'edit' ? 'Saving…' : 'Adding…') : mode === 'edit' ? 'Save Changes' : 'Add Domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { GlobeIcon };
