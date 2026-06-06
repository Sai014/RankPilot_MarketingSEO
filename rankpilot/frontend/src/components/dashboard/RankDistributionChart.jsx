export default function RankDistributionChart({ data = [] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Rank Distribution</h3>
        <p className="text-xs text-slate-500 mt-0.5">How your pages spread across SERP positions</p>
      </div>

      <div className="flex-1 flex items-end gap-3 min-h-[160px]">
        {data.map((item) => {
          const height = `${Math.max((item.count / max) * 100, item.count ? 8 : 4)}%`;
          return (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-xs font-mono text-slate-400 tabular-nums">{item.count}</span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-lg transition-all duration-500"
                  style={{ height, backgroundColor: item.color, opacity: item.count ? 1 : 0.25 }}
                  title={`${item.label}: ${item.count}`}
                />
              </div>
              <span className="text-[10px] text-slate-500 text-center leading-tight">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
