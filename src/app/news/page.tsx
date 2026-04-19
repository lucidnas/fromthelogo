"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Newspaper, PlayCircle, MessageCircle, Globe } from "lucide-react";

type NewsItem = {
  title: string;
  source: string;
  type: "news" | "twitter" | "youtube" | "rss";
  date?: string;
  url?: string;
  snippet?: string;
  score?: number;
};

type GroupedNews = {
  journalism: NewsItem[];
  twitter: NewsItem[];
  outlet: NewsItem[];
  gnews: NewsItem[];
  competitors: NewsItem[];
};

type NewsPreview = {
  fetchedAt: string;
  durationMs: number;
  counts: Record<keyof GroupedNews, number>;
  total: number;
  youtubeShare: number;
  items: GroupedNews;
};

const GROUPS: Array<{
  key: keyof GroupedNews;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    key: "journalism",
    label: "YouTube Journalism",
    subtitle: "Mick Talks Hoops + Rachel DeMita — primary storyline source",
    icon: PlayCircle,
    accent: "from-red-500/20 to-rose-500/5 border-red-500/30 text-red-300",
  },
  {
    key: "competitors",
    label: "Competitor Channels",
    subtitle: "From The Logo, Hoop Reports, Basketball Top Stories",
    icon: PlayCircle,
    accent: "from-orange-500/20 to-amber-500/5 border-orange-500/30 text-orange-300",
  },
  {
    key: "twitter",
    label: "Twitter / X",
    subtitle: "@CClarkReport + @kenswift via Nitter RSS",
    icon: MessageCircle,
    accent: "from-sky-500/20 to-blue-500/5 border-sky-500/30 text-sky-300",
  },
  {
    key: "outlet",
    label: "Outlet Deep Coverage",
    subtitle: "SI, ClutchPoints, Athlon Sports (Google News site search)",
    icon: Newspaper,
    accent: "from-emerald-500/20 to-teal-500/5 border-emerald-500/30 text-emerald-300",
  },
  {
    key: "gnews",
    label: "General Google News",
    subtitle: "Broad queries for caitlin clark / indiana fever",
    icon: Globe,
    accent: "from-gray-500/20 to-gray-600/5 border-gray-500/30 text-gray-300",
  },
];

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
            Live view of what the pitch generator is actually pulling from each source.
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

          <div className="space-y-10 mt-10">
            {GROUPS.map((group) => {
              const items = data.items[group.key];
              return (
                <SourceSection
                  key={group.key}
                  label={group.label}
                  subtitle={group.subtitle}
                  icon={group.icon}
                  accent={group.accent}
                  items={items}
                  share={data.total > 0 ? (items.length / data.total) * 100 : 0}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryBar({ data }: { data: NewsPreview }) {
  const youtubeCount = data.counts.journalism + data.counts.competitors;
  return (
    <div className="rounded-2xl border border-[#22222b] bg-[#121217] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-400">Total items</div>
          <div className="text-3xl font-bold text-white">{data.total}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">YouTube share</div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold ${
                data.youtubeShare >= 80
                  ? "text-emerald-300"
                  : data.youtubeShare >= 60
                  ? "text-yellow-300"
                  : "text-red-300"
              }`}
            >
              {data.youtubeShare}%
            </span>
            <span className="text-xs text-gray-500">
              {youtubeCount} / {data.total}
            </span>
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Fetch time</div>
          <div className="text-3xl font-bold text-white">{(data.durationMs / 1000).toFixed(1)}s</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Fetched at</div>
          <div className="text-sm text-gray-300 font-mono">
            {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="h-2 w-full rounded-full overflow-hidden bg-[#1a1a24] flex">
        {GROUPS.map((group) => {
          const count = data.counts[group.key];
          const pct = data.total > 0 ? (count / data.total) * 100 : 0;
          if (pct === 0) return null;
          const bg =
            group.key === "journalism"
              ? "bg-red-500"
              : group.key === "competitors"
              ? "bg-orange-500"
              : group.key === "twitter"
              ? "bg-sky-500"
              : group.key === "outlet"
              ? "bg-emerald-500"
              : "bg-gray-500";
          return (
            <div
              key={group.key}
              className={bg}
              style={{ width: `${pct}%` }}
              title={`${group.label}: ${count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {GROUPS.map((group) => {
          const count = data.counts[group.key];
          const dot =
            group.key === "journalism"
              ? "bg-red-500"
              : group.key === "competitors"
              ? "bg-orange-500"
              : group.key === "twitter"
              ? "bg-sky-500"
              : group.key === "outlet"
              ? "bg-emerald-500"
              : "bg-gray-500";
          return (
            <div key={group.key} className="flex items-center gap-2 text-gray-400">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="text-gray-300">{group.label}</span>
              <span className="font-mono">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceSection({
  label,
  subtitle,
  icon: Icon,
  accent,
  items,
  share,
}: {
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  items: NewsItem[];
  share: number;
}) {
  return (
    <section>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-lg bg-gradient-to-r ${accent} border`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-xs text-gray-300">
          {items.length} item{items.length === 1 ? "" : "s"} · {share.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>

      {items.length === 0 ? (
        <div className="p-4 rounded-lg border border-[#22222b] bg-[#121217] text-sm text-gray-500 italic">
          No items fetched from this source.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={`${label}-${i}`}
              className="p-3 rounded-lg border border-[#22222b] bg-[#121217] hover:border-purple-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white leading-snug">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-purple-300 transition-colors"
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </div>
                  {item.snippet && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {item.snippet}
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-gray-400">{item.source}</span>
                    {item.date && <span>· {item.date}</span>}
                    {typeof item.score === "number" && item.score > 0 && (
                      <span>· {formatViews(item.score)} views</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}
