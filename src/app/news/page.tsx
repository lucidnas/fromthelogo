"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Newspaper,
  PlayCircle,
  ExternalLink,
  ChevronDown,
  FlaskConical,
  Check,
  Sparkles,
} from "lucide-react";

type NewsItem = {
  title: string;
  source: string;
  type: "youtube" | "athlon";
  date?: string;
  url?: string;
  snippet?: string;
  score?: number;
};

type GroupedNews = {
  youtube: NewsItem[];
  athlon: NewsItem[];
};

type NewsPreview = {
  fetchedAt: string;
  durationMs: number;
  counts: Record<keyof GroupedNews, number>;
  total: number;
  youtubeShare: number;
  items: GroupedNews;
};

type ResearchSummary = {
  angle: string;
  villain: string | null;
  keyMoments: string[];
  quotes: string[];
  stats: string[];
  whyItResonated: string;
};

type ResearchRow = {
  id: number;
  url: string;
  source: string;
  title: string;
  viewCount: number | null;
  summary: ResearchSummary;
  fetchedAt: string;
};

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

function viewsTierClass(n: number) {
  if (n >= 500_000) return "text-yellow-300 bg-yellow-500/15 border-yellow-500/40";
  if (n >= 100_000) return "text-purple-300 bg-purple-500/15 border-purple-500/40";
  if (n >= 20_000) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/40";
  return "text-gray-400 bg-gray-700/30 border-gray-600/40";
}

export default function NewsPage() {
  const [data, setData] = useState<NewsPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [researchByUrl, setResearchByUrl] = useState<Record<string, ResearchRow>>({});
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news-preview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fetch failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResearch = async () => {
    try {
      const res = await fetch("/api/research", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const map: Record<string, ResearchRow> = {};
      for (const r of json.results || []) map[r.url] = r;
      setResearchByUrl(map);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    load();
    loadExistingResearch();
  }, []);

  const toggleSelected = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleExpanded = (url: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const runResearch = async (forceRefresh = false) => {
    if (!data || selected.size === 0) return;
    const urlToItem = new Map<string, NewsItem>();
    for (const it of [...data.items.youtube, ...data.items.athlon]) {
      if (it.url) urlToItem.set(it.url, it);
    }
    const items = Array.from(selected)
      .map((url) => urlToItem.get(url))
      .filter((it): it is NewsItem => !!it)
      .map((it) => ({
        url: it.url!,
        source: it.source,
        title: it.title,
        viewCount: it.score,
      }));

    if (items.length === 0) return;

    setResearching(true);
    setResearchError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, forceRefresh }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Research failed");

      setResearchByUrl((prev) => {
        const next = { ...prev };
        for (const r of json.results) {
          next[r.url] = {
            id: 0,
            url: r.url,
            source: r.source,
            title: r.title,
            viewCount: null,
            summary: r.summary,
            fetchedAt: new Date().toISOString(),
          };
        }
        return next;
      });
      // Auto-expand newly researched items
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const r of json.results) next.add(r.url);
        return next;
      });
      setSelected(new Set());
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setResearching(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="w-7 h-7 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">News Preview</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Last 30 videos per channel, newest first. Click a section to collapse it.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-200 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-6">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      )}

      {data && (
        <NewsBody
          data={data}
          selected={selected}
          toggleSelected={toggleSelected}
          researchByUrl={researchByUrl}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#121217] border border-purple-500/40 shadow-xl shadow-purple-500/10">
          <span className="text-sm text-gray-300">
            <span className="font-semibold text-white">{selected.size}</span> selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            clear
          </button>
          <button
            onClick={() => runResearch(false)}
            disabled={researching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {researching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Researching...
              </>
            ) : (
              <>
                <FlaskConical className="w-4 h-4" /> Research selected
              </>
            )}
          </button>
          <button
            onClick={() => runResearch(true)}
            disabled={researching}
            className="text-xs text-purple-300 hover:text-purple-200 disabled:opacity-50"
            title="Force Gemini to re-fetch even if cached"
          >
            force refresh
          </button>
        </div>
      )}

      {researchError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-200 text-sm">
          {researchError}
        </div>
      )}
    </div>
  );
}

function NewsBody({
  data,
  selected,
  toggleSelected,
  researchByUrl,
  expanded,
  toggleExpanded,
}: {
  data: NewsPreview;
  selected: Set<string>;
  toggleSelected: (url: string) => void;
  researchByUrl: Record<string, ResearchRow>;
  expanded: Set<string>;
  toggleExpanded: (url: string) => void;
}) {
  // Group YouTube items by source so each channel renders as its own section.
  // Keep YouTube's natural order (newest first) within each channel.
  const channelGroups = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const item of data.items.youtube) {
      if (!map.has(item.source)) map.set(item.source, []);
      map.get(item.source)!.push(item);
    }
    return Array.from(map.entries()).map(([source, items]) => ({ source, items }));
  }, [data]);

  return (
    <>
      <SummaryBar data={data} />

      <div className="mt-10 space-y-4">
        {channelGroups.map((g) => (
          <CollapsibleSection
            key={g.source}
            title={g.source}
            subtitle={`Last ${g.items.length} videos · newest first`}
            accent="from-red-500/20 to-rose-500/5 border-red-500/30"
            icon={PlayCircle}
            defaultOpen
          >
            <ItemList
              items={g.items}
              selected={selected}
              toggleSelected={toggleSelected}
              researchByUrl={researchByUrl}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              showViews
            />
          </CollapsibleSection>
        ))}

        <CollapsibleSection
          title="Athlon Sports"
          subtitle={`${data.items.athlon.length} articles · outlet coverage`}
          accent="from-emerald-500/20 to-teal-500/5 border-emerald-500/30"
          icon={Newspaper}
          defaultOpen
        >
          <ItemList
            items={data.items.athlon}
            selected={selected}
            toggleSelected={toggleSelected}
            researchByUrl={researchByUrl}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
            showViews={false}
          />
        </CollapsibleSection>
      </div>
    </>
  );
}

function SummaryBar({ data }: { data: NewsPreview }) {
  const topView = data.items.youtube.reduce((max, i) => Math.max(max, i.score || 0), 0);
  return (
    <div className="rounded-2xl border border-[#22222b] bg-[#121217] p-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Stat label="Total items" value={data.total.toString()} />
        <Stat
          label="YouTube"
          value={data.counts.youtube.toString()}
          sub={`${data.youtubeShare}% of mix`}
        />
        <Stat label="Athlon" value={data.counts.athlon.toString()} />
        <Stat label="Top item" value={formatViews(topView)} sub="views" />
        <Stat label="Fetch time" value={`${(data.durationMs / 1000).toFixed(1)}s`} />
        <Stat
          label="Fetched"
          value={new Date(data.fetchedAt).toLocaleTimeString()}
          mono
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold text-white ${mono ? "font-mono text-lg" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  accent,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accent} bg-[#121217]/60 overflow-hidden`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 text-left min-w-0">
          <Icon className="w-5 h-5 text-white shrink-0" />
          <div className="min-w-0">
            <div className="text-base font-semibold text-white truncate">{title}</div>
            <div className="text-xs text-gray-400 truncate">{subtitle}</div>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function ItemList({
  items,
  selected,
  toggleSelected,
  researchByUrl,
  expanded,
  toggleExpanded,
  showViews,
}: {
  items: NewsItem[];
  selected: Set<string>;
  toggleSelected: (url: string) => void;
  researchByUrl: Record<string, ResearchRow>;
  expanded: Set<string>;
  toggleExpanded: (url: string) => void;
  showViews: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-[#22222b] bg-[#0d0d12] text-sm text-gray-500 italic">
        No items fetched.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const url = item.url || "";
        const researched = url ? researchByUrl[url] : undefined;
        const isSelected = url ? selected.has(url) : false;
        const isExpanded = url ? expanded.has(url) : false;
        const views = item.score || 0;
        return (
          <li
            key={`${item.source}-${i}`}
            className={`rounded-lg border bg-[#0d0d12] transition-colors ${
              isSelected
                ? "border-purple-500/60"
                : researched
                ? "border-purple-500/20"
                : "border-[#22222b] hover:border-purple-500/40"
            }`}
          >
            <div className="p-3 flex items-start gap-3">
              <label className="shrink-0 mt-1 inline-flex items-center justify-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => url && toggleSelected(url)}
                  disabled={!url}
                  className="w-4 h-4 rounded border-gray-600 bg-[#121217] accent-purple-500"
                />
              </label>
              {showViews && (
                <div
                  className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-bold border ${viewsTierClass(
                    views
                  )}`}
                  style={{ minWidth: 64, textAlign: "center" }}
                >
                  {formatViews(views)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white hover:text-purple-300 transition-colors leading-snug inline-flex items-start gap-1.5"
                    >
                      {item.title}
                      {!showViews && <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />}
                    </a>
                  ) : (
                    <span className="text-sm text-white leading-snug">{item.title}</span>
                  )}
                  {researched && (
                    <button
                      onClick={() => url && toggleExpanded(url)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 border border-purple-500/40 text-purple-200 hover:bg-purple-500/25"
                    >
                      <Check className="w-3 h-3" />
                      {isExpanded ? "hide research" : "research"}
                    </button>
                  )}
                </div>
                {item.snippet && !researched && (
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.snippet}</div>
                )}
                {item.date && <div className="text-[11px] text-gray-500 mt-1">{item.date}</div>}
              </div>
            </div>

            {researched && isExpanded && (
              <ResearchPanel summary={researched.summary} fetchedAt={researched.fetchedAt} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ResearchPanel({
  summary,
  fetchedAt,
}: {
  summary: ResearchSummary;
  fetchedAt: string;
}) {
  return (
    <div className="border-t border-[#22222b] p-4 bg-[#0a0a0f]/80 space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-purple-300">
        <Sparkles className="w-3 h-3" />
        <span className="font-semibold">Research summary</span>
        <span className="text-gray-500">· {new Date(fetchedAt).toLocaleString()}</span>
      </div>
      <ResearchField label="Angle" value={summary.angle} />
      {summary.villain && <ResearchField label="Villain" value={summary.villain} />}
      <ResearchList label="Key moments" items={summary.keyMoments} />
      <ResearchList label="Quotes" items={summary.quotes} />
      <ResearchList label="Stats" items={summary.stats} />
      <ResearchField label="Why it resonated" value={summary.whyItResonated} />
    </div>
  );
}

function ResearchField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-sm text-gray-200 mt-0.5 leading-relaxed">{value}</div>
    </div>
  );
}

function ResearchList({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <ul className="mt-0.5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-200 leading-relaxed flex items-start gap-2">
            <span className="text-gray-600 shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
