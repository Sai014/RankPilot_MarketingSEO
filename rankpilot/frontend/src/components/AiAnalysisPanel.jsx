function renderInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-medium">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

const GROUP_VARIANTS = {
  strength: {
    card: 'border-emerald-500/30 bg-emerald-950/15',
    title: 'text-emerald-300',
    dot: 'bg-emerald-400',
    icon: '↑',
  },
  weakness: {
    card: 'border-red-500/25 bg-red-950/15',
    title: 'text-red-300',
    dot: 'bg-red-400',
    icon: '!',
  },
  gap: {
    card: 'border-violet-500/30 bg-violet-950/15',
    title: 'text-violet-300',
    dot: 'bg-violet-400',
    icon: '◆',
  },
  tip: {
    card: 'border-amber-500/30 bg-amber-950/20',
    title: 'text-amber-300',
    dot: 'bg-amber-400',
    icon: '★',
  },
  default: {
    card: 'border-brand-500/25 bg-brand-950/20',
    title: 'text-brand-300',
    dot: 'bg-brand-400',
    icon: '•',
  },
};

function groupVariant(title) {
  const t = title.toLowerCase();
  if (t.includes('strength')) return 'strength';
  if (t.includes('weakness') || t.includes('issue')) return 'weakness';
  if (t.includes('gap') || t.includes('missing')) return 'gap';
  if (t.includes('optim') || t.includes('action') || t.includes('tip') || t.includes('recommend')) {
    return 'tip';
  }
  if (t.includes('opportunit')) return 'gap';
  return 'default';
}

function sectionAccent(title) {
  const v = groupVariant(title);
  return GROUP_VARIANTS[v];
}

function parseAnalysis(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const blocks = [];
  let listItems = [];
  let paragraph = [];
  let currentGroup = null;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  }

  function flushList() {
    if (!listItems.length) return;
    const last = blocks[blocks.length - 1];
    if (last?.type === 'section') {
      last.items = [...listItems];
    } else {
      blocks.push({ type: 'list', items: [...listItems] });
    }
    listItems = [];
  }

  function flushGroup() {
    if (currentGroup?.items.length) {
      blocks.push(currentGroup);
    }
    currentGroup = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const categoryMatch = trimmed.match(/^(?:\*\*)?([A-Za-z][\w\s/]+?)(?:\*\*)?:\s*$/);
    if (categoryMatch && !/^\d+\./.test(trimmed) && categoryMatch[1].length < 50) {
      const title = categoryMatch[1].trim();
      if (!/analysis for/i.test(title)) {
        flushParagraph();
        flushList();
        flushGroup();
        currentGroup = { type: 'group', title, variant: groupVariant(title), items: [] };
        continue;
      }
    }

    const numberedItem = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.+)$/);
    if (numberedItem && numberedItem[3].trim()) {
      flushParagraph();
      flushList();
      const item = { label: numberedItem[2].replace(/:$/, ''), text: numberedItem[3] };
      if (currentGroup) {
        currentGroup.items.push(item);
      } else {
        blocks.push({ type: 'item', number: numberedItem[1], ...item });
      }
      continue;
    }

    const sectionMatch = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)$/);
    if (sectionMatch) {
      flushParagraph();
      flushList();
      flushGroup();
      blocks.push({
        type: 'section',
        number: sectionMatch[1],
        title: sectionMatch[2].replace(/:$/, ''),
        intro: sectionMatch[3] || null,
        items: [],
      });
      continue;
    }

    const headingMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushGroup();
      blocks.push({ type: 'heading', title: headingMatch[1].replace(/:$/, '') });
      continue;
    }

    const bulletMatch = trimmed.match(/^[*\-•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    const plainNumbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (plainNumbered && currentGroup) {
      flushParagraph();
      currentGroup.items.push({ label: null, text: plainNumbered[2] });
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushGroup();
  return blocks;
}

function BulletList({ items, dotClass = 'bg-brand-400/80' }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2.5 mt-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
          <span>{renderInline(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function GroupBlock({ block }) {
  const accent = GROUP_VARIANTS[block.variant] || GROUP_VARIANTS.default;
  return (
    <div className={`rounded-xl border p-4 ${accent.card}`}>
      <h4 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3 ${accent.title}`}>
        <span className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-900/60 text-xs">
          {accent.icon}
        </span>
        {block.title}
      </h4>
      <ol className="space-y-3">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="shrink-0 w-5 text-xs font-bold text-slate-500 tabular-nums mt-0.5">
              {i + 1}.
            </span>
            <div className="text-slate-300">
              {item.label ? (
                <>
                  <span className="text-white font-medium">{item.label}: </span>
                  {renderInline(item.text)}
                </>
              ) : (
                renderInline(item.text)
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

function AnalysisBlock({ block }) {
  if (block.type === 'heading') {
    return (
      <div className="pb-1 border-b border-slate-800/80">
        <h4 className="text-sm font-semibold text-brand-300 uppercase tracking-wide">{block.title}</h4>
      </div>
    );
  }

  if (block.type === 'paragraph') {
    return <p className="text-sm text-slate-300 leading-relaxed">{renderInline(block.text)}</p>;
  }

  if (block.type === 'group') {
    return <GroupBlock block={block} />;
  }

  if (block.type === 'item') {
    const accent = GROUP_VARIANTS.default;
    return (
      <div className={`rounded-lg border p-3 ${accent.card}`}>
        <p className="text-sm text-slate-300 leading-relaxed">
          <span className="text-slate-500 font-mono text-xs mr-2">{block.number}.</span>
          {block.label && <span className="text-white font-medium">{block.label}: </span>}
          {renderInline(block.text)}
        </p>
      </div>
    );
  }

  if (block.type === 'section') {
    const accent = sectionAccent(block.title);
    return (
      <div className={`rounded-xl border p-4 ${accent.card}`}>
        <div className="flex items-start gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-inset ${accent.title} bg-slate-900/80`}
          >
            {block.number}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-white">{block.title}</h4>
            {block.intro && (
              <p className="text-sm text-slate-300 leading-relaxed mt-2">{renderInline(block.intro)}</p>
            )}
            <BulletList items={block.items} dotClass={accent.dot} />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'list') {
    return <BulletList items={block.items} />;
  }

  return null;
}

export default function AiAnalysisPanel({
  title = 'AI Analysis',
  subtitle = 'Actionable insights powered by Groq',
  analysis,
  model,
  className = '',
}) {
  const text = typeof analysis === 'string' ? analysis : analysis?.analysis;
  if (!text) return null;

  const blocks = parseAnalysis(text);
  const groups = blocks.filter((b) => b.type === 'group');
  const rest = blocks.filter((b) => b.type !== 'group');
  const hasGroupGrid = groups.length >= 2;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950/30 ${className}`}
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative p-6 border-b border-slate-800/80">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-300 ring-1 ring-brand-500/30">
            <SparkleIcon />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
            {model && <p className="text-xs text-slate-600 mt-1">Powered by {model}</p>}
          </div>
        </div>
      </div>

      <div className="relative p-6 space-y-5">
        {blocks.length === 0 ? (
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <>
            {rest.map((block, i) => (
              <AnalysisBlock key={`r-${i}`} block={block} />
            ))}
            {groups.length > 0 && (
              <div className={hasGroupGrid ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}>
                {groups.map((block, i) => (
                  <GroupBlock key={`g-${i}`} block={block} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
