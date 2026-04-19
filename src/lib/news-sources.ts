// News aggregator for Caitlin Clark / WNBA story discovery.
//
// Sources:
// 1. YouTube channels — page scraped (bypasses RSS 15-cap, gets view counts)
//    Add new channels to YOUTUBE_CHANNELS below.
// 2. Athlon Sports WNBA — site RSS filtered for /wnba/ + Google News site search, deduped.
//
// NOT a news source: Hoop Reports / DKM / JxmyHighroller — those live in the
// TitleTemplate table and are used only for title/story-structure framing.

export type NewsItem = {
  title: string;
  source: string;
  type: "youtube" | "athlon";
  date?: string;
  url?: string;
  snippet?: string;
  score?: number; // view count for YouTube items
};

// ============================================================================
// YouTube channel config — append here to add more news sources
// ============================================================================

type YouTubeChannel = { id: string; name: string; limit: number };

const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  { id: "UCPzp2k1LSr1ctDEsOhg4-aw", name: "Mick Talks Hoops", limit: 30 },
  { id: "UCBS2RdExOLDYVLnfsZ2Q4-w", name: "Rachel DeMita", limit: 30 },
];

// ============================================================================
// YouTube page scraper (view counts + up to channel.limit videos)
// ============================================================================

async function scrapeYouTubeChannel(channel: YouTubeChannel): Promise<NewsItem[]> {
  try {
    const url = `https://www.youtube.com/channel/${channel.id}/videos`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videosTab = tabs.find((t: any) => t?.tabRenderer?.content?.richGridRenderer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || [];

    const items: NewsItem[] = [];
    for (const c of contents.slice(0, channel.limit)) {
      const item = parseYouTubeEntry(c, channel.name);
      if (item) items.push(item);
    }
    // Per-channel sort: newest-first from YouTube, then sort those by views.
    return items.sort((a, b) => (b.score || 0) - (a.score || 0));
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseYouTubeEntry(c: any, source: string): NewsItem | null {
  // Legacy renderer (still used by most channels)
  const video = c?.richItemRenderer?.content?.videoRenderer;
  if (video) {
    const title = video?.title?.runs?.[0]?.text || video?.title?.simpleText;
    if (!title) return null;
    const viewCountText = video?.viewCountText?.simpleText || video?.shortViewCountText?.simpleText;
    const descSnippet = video?.descriptionSnippet?.runs?.map((r: { text: string }) => r.text).join("") || "";
    return {
      title: String(title).trim(),
      source,
      type: "youtube",
      date: video?.publishedTimeText?.simpleText || "",
      url: video?.videoId ? `https://youtube.com/watch?v=${video.videoId}` : undefined,
      score: viewCountText ? parseViews(viewCountText) : 0,
      snippet: descSnippet,
    };
  }

  // New lockupViewModel layout (rolling out across channels)
  const lockup = c?.richItemRenderer?.content?.lockupViewModel;
  if (lockup) {
    const meta = lockup?.metadata?.lockupMetadataViewModel;
    const title = meta?.title?.content;
    if (!title) return null;
    const metaParts =
      meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewText = metaParts.find((p: any) => /view/i.test(p?.text?.content || ""))?.text?.content;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateText = metaParts.find((p: any) => /ago/i.test(p?.text?.content || ""))?.text?.content;
    return {
      title: String(title).trim(),
      source,
      type: "youtube",
      date: dateText || "",
      url: lockup?.contentId ? `https://youtube.com/watch?v=${lockup.contentId}` : undefined,
      score: viewText ? parseViews(viewText) : 0,
    };
  }

  return null;
}

// Handles "1,234 views", "12K views", "3.4M views"
function parseViews(text: string): number {
  const match = text.match(/([\d.,]+)\s*([KMB])?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(num)) return 0;
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

async function fetchYouTube(): Promise<NewsItem[]> {
  const results = await Promise.all(YOUTUBE_CHANNELS.map(scrapeYouTubeChannel));
  return results.flat();
}

// ============================================================================
// Athlon Sports — site RSS filtered for /wnba/ + Google News site search
// ============================================================================

async function fetchAthlonRss(): Promise<NewsItem[]> {
  try {
    const res = await fetch("https://athlonsports.com/rss", {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const block of itemBlocks) {
      const linkMatch = block.match(/<link>(.*?)<\/link>/);
      const link = linkMatch?.[1]?.trim();
      if (!link || !link.includes("athlonsports.com/wnba/")) continue;

      const titleMatch =
        block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        block.match(/<title>([\s\S]*?)<\/title>/);
      const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
      const descMatch =
        block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        block.match(/<description>([\s\S]*?)<\/description>/);

      const title = titleMatch?.[1]?.trim();
      if (!title) continue;

      items.push({
        title,
        source: "Athlon Sports",
        type: "athlon",
        date: dateMatch?.[1]?.slice(0, 16),
        url: link,
        snippet: descMatch?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 240),
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchAthlonGoogleNews(): Promise<NewsItem[]> {
  try {
    const query = "site:athlonsports.com/wnba caitlin clark OR fever OR wnba";
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const block of itemBlocks.slice(0, 25)) {
      const titleMatch =
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/);
      const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
      const linkMatch = block.match(/<link>(.*?)<\/link>/);

      const rawTitle = titleMatch?.[1]?.trim() || "";
      if (!rawTitle || rawTitle.length < 15) continue;
      // Google News titles end with " - Outlet Name"
      const title = rawTitle.replace(/\s*[-–—]\s*[^-–—]+$/, "").trim();
      if (!title || title.length < 10) continue;

      items.push({
        title,
        source: "Athlon Sports",
        type: "athlon",
        date: dateMatch?.[1]?.slice(0, 16),
        url: linkMatch?.[1],
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchAthlon(): Promise<NewsItem[]> {
  const [rss, gnews] = await Promise.all([fetchAthlonRss(), fetchAthlonGoogleNews()]);
  // Dedupe by URL first, then by title prefix as a fallback for Google's wrapped URLs.
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of [...rss, ...gnews]) {
    const urlKey = item.url || "";
    const titleKey = item.title.toLowerCase().slice(0, 60);
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (seenTitles.has(titleKey)) continue;
    if (urlKey) seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    merged.push(item);
  }
  return merged;
}

// ============================================================================
// Aggregator — structured (for UI) + prompt-string (for AI) variants
// ============================================================================

export type GroupedNews = {
  youtube: NewsItem[];
  athlon: NewsItem[];
};

export async function fetchAllNewsItems(): Promise<GroupedNews> {
  const [youtube, athlon] = await Promise.all([fetchYouTube(), fetchAthlon()]);
  return {
    youtube: youtube.slice(0, 150),
    athlon: athlon.slice(0, 40),
  };
}

export async function fetchAllNewsSources(): Promise<string> {
  const grouped = await fetchAllNewsItems();
  const sections: string[] = [];

  if (grouped.youtube.length) {
    sections.push("=== WNBA YOUTUBE COVERAGE (primary storyline source — sorted by views, high views = proven audience demand) ===");
    sections.push(
      grouped.youtube
        .map((i, n) => {
          const views = i.score ? ` [${i.score.toLocaleString()} views]` : "";
          const date = i.date ? ` (${i.date})` : "";
          const base = `${n + 1}. "${i.title}" — ${i.source}${views}${date}`;
          return i.snippet ? `${base}\n   ↳ ${i.snippet.slice(0, 180)}` : base;
        })
        .join("\n")
    );
  }

  if (grouped.athlon.length) {
    sections.push("\n=== ATHLON SPORTS WNBA (outlet coverage — named characters, narrative angles) ===");
    sections.push(
      grouped.athlon
        .map((i, n) => `${n + 1}. "${i.title}"${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  if (sections.length === 0) {
    return "No news could be fetched. Fall back to evergreen Caitlin Clark career moments.";
  }

  return sections.join("\n");
}
