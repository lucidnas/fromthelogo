"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Newspaper, PlayCircle, ExternalLink, Flame } from "lucide-react";

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

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="w-7 h-7 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">News Preview</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Live view of what the pitch generator is pulling. YouTube items are sorted by views — proven audience demand.
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
        <>
          <SummaryBar data={data} />

          <HotRow youtube={data.items.youtube} />

          <section className="mt-12">
            <SectionHeader
              icon={PlayCircle}
              accent="from-red-500/20 to-rose-500/5 border-red-500/30 text-red-300"
              label="YouTube Coverage"
              subtitle="Sorted by views — proven audience demand"
              count={data.items.youtube.length}
            />
            <YouTubeList items={data.items.youtube} />
          </section>

          <section className="mt-12">
            <SectionHeader
              icon={Newspaper}
              accent="from-emerald-500/20 to-teal-500/5 border-emerald-500/30 text-emerald-300"
              label="Athlon Sports"
              subtitle="Outlet narrative coverage — named characters and quotes"
              count={data.items.athlon.length}
            />
            <AthlonList items={data.items.athlon} />
          </section>
        </>
      )}
    </div>
  );
}

function SummaryBar({ data }: { data: NewsPreview }) {
  const topView = data.items.youtube[0]?.score || 0;
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

function HotRow({ youtube }: { youtube: NewsItem[] }) {
  const top = youtube.slice(0, 6);
  if (top.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold text-white">Top by Views</h2>
        <span className="text-xs text-gray-500">across all YouTube sources</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {top.map((item, i) => (
          <HotCard key={`hot-${i}`} item={item} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}

function HotCard({ item, rank }: { item: NewsItem; rank: number }) {
  const views = item.score || 0;
  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group p-4 rounded-xl border border-[#22222b] bg-[#121217] hover:border-purple-500/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="text-xl font-bold text-gray-600 font-mono w-8 shrink-0">
          {rank.toString().padStart(2, "0")}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border mb-2 ${viewsTierClass(
              views
            )}`}
          >
            {formatViews(views)} views
          </div>
          <div className="text-sm text-white leading-snug group-hover:text-purple-300 transition-colors line-clamp-3">
            {item.title}
          </div>
          <div className="text-[11px] text-gray-500 mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-gray-400">{item.source}</span>
            {item.date && <span>· {item.date}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}

function SectionHeader({
  icon: Icon,
  accent,
  label,
  subtitle,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  label: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="mb-4">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-gradient-to-r ${accent} border`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-xs text-gray-300">{count} items</span>
      </div>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function YouTubeList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-[#22222b] bg-[#121217] text-sm text-gray-500 italic">
        No YouTube items fetched.
      </div>
    );
  }

  // Group by source so you can scan per channel
  const bySource = new Map<string, NewsItem[]>();
  for (const item of items) {
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source)!.push(item);
  }

  return (
    <div className="space-y-8">
      {Array.from(bySource.entries()).map(([source, list]) => (
        <div key={source}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">{source}</h3>
            <span className="text-xs text-gray-500">
              {list.length} videos · top {formatViews(list[0]?.score || 0)}
            </span>
          </div>
          <ul className="space-y-2">
            {list.map((item, i) => {
              const views = item.score || 0;
              return (
                <li
                  key={`${source}-${i}`}
                  className="p-3 rounded-lg border border-[#22222b] bg-[#121217] hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-bold border ${viewsTierClass(
                        views
                      )}`}
                      style={{ minWidth: 64, textAlign: "center" }}
                    >
                      {formatViews(views)}
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-white hover:text-purple-300 transition-colors leading-snug"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className="text-sm text-white leading-snug">{item.title}</span>
                      )}
                      {item.snippet && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {item.snippet}
                        </div>
                      )}
                      {item.date && (
                        <div className="text-[11px] text-gray-500 mt-1">{item.date}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AthlonList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-[#22222b] bg-[#121217] text-sm text-gray-500 italic">
        No Athlon items fetched.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`athlon-${i}`}
          className="p-3 rounded-lg border border-[#22222b] bg-[#121217] hover:border-purple-500/40 transition-colors"
        >
          <div className="min-w-0 flex-1">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white hover:text-purple-300 transition-colors leading-snug inline-flex items-start gap-1.5"
              >
                {item.title}
                <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
              </a>
            ) : (
              <span className="text-sm text-white leading-snug">{item.title}</span>
            )}
            {item.snippet && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.snippet}</div>
            )}
            {item.date && <div className="text-[11px] text-gray-500 mt-1">{item.date}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
