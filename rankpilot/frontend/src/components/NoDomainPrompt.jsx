import { Link } from 'react-router-dom';
import { GlobeIcon } from './DomainModal';

export default function NoDomainPrompt({ title = 'No domain connected' }) {
  return (
    <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl max-w-lg mx-auto mt-8">
      <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
        <GlobeIcon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-slate-400 mt-2 mb-6">
        Please connect a domain first to view pages and metrics.
      </p>
      <Link
        to="/domains"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Go to Domains
      </Link>
    </div>
  );
}
