// Multi-source news aggregator for Caitlin Clark / WNBA stories.
// Sources (priority order):
// 1. Mick Talks Hoops + Rachel DeMita — WNBA journalism YouTube channels
// 2. Twitter: @CClarkReport, @kenswift via Nitter RSS
// 3. SI, ClutchPoints, Athlon Sports via Google News site search
// 4. Google News (general CC search)
// 5. Competitor narrative channels (Hoop Reports, BTS, From The Logo)

export type NewsItem = {
  title: string;
  source: string;
  type: "news" | "twitter" | "youtube" | "rss";
  date?: string;
  url?: string;
  snippet?: string;
  score?: number;
};

// ===========================================================================
// YouTube page scraper (bypasses RSS 15-video limit)
// ===========================================================================

async function scrapeYouTubeChannel(channelId: string, channelName: string, limit: number): Promise<NewsItem[]> {
  try {
    const url = `https://www.youtube.com/channel/${channelId}/videos`;
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
    for (const c of contents.slice(0, limit)) {
      const video = c?.richItemRenderer?.content?.videoRenderer;
      if (!video) continue;
      const title = video?.title?.runs?.[0]?.text || video?.title?.simpleText;
      const publishedText = video?.publishedTimeText?.simpleText;
      const viewCountText = video?.viewCountText?.simpleText || video?.shortViewCountText?.simpleText;
      const descSnippet = video?.descriptionSnippet?.runs?.map((r: { text: string }) => r.text).join("") || "";

      if (!title) continue;

      items.push({
        title: title.trim(),
        source: channelName,
        type: "youtube",
        date: publishedText || "",
        score: viewCountText ? parseInt(viewCountText.replace(/[^0-9]/g, "")) || 0 : 0,
        snippet: descSnippet,
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchYouTubeJournalism(): Promise<NewsItem[]> {
  // Mick Talks Hoops = hourly WNBA coverage. Rachel DeMita = WNBA journalism.
  const channels = [
    { id: "UCcT4c8glrjIO0pIVzJ6BWbg", name: "Mick Talks Hoops", limit: 100 },
    { id: "UCBS2RdExOLDYVLnfsZ2Q4-w", name: "Rachel DeMita", limit: 30 },
  ];
  const results = await Promise.all(channels.map((c) => scrapeYouTubeChannel(c.id, c.name, c.limit)));
  return results.flat();
}

async function fetchYouTubeCompetitors(): Promise<NewsItem[]> {
  // Narrative competitors — filter to CC/WNBA only, use RSS (15 latest is enough)
  const channels = [
    { id: "UCvWdLRqA7R2Gggisxn4Xkhg", name: "From The Logo" },
    { id: "UCYZOGKxkcE3BUwF5HfuzP1w", name: "Hoop Reports" },
    { id: "UCj7OqYE9cNEzT6y_-Z3BdbA", name: "Basketball Top Stories" },
  ];

  const items: NewsItem[] = [];
  for (const channel of channels) {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      for (const entry of entries.slice(0, 10)) {
        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
        const title = titleMatch?.[1]?.trim();
        if (!title) continue;

        const lower = title.toLowerCase();
        if (
          !lower.includes("caitlin") &&
          !lower.includes("clark") &&
          !lower.includes("wnba") &&
          !lower.includes("fever") &&
          !lower.includes("indiana")
        ) continue;

        items.push({
          title,
          source: channel.name,
          type: "youtube",
          date: publishedMatch?.[1]?.slice(0, 10),
        });
      }
    } catch { /* continue */ }
  }
  return items;
}

// ===========================================================================
// Twitter via Nitter RSS (public X/Twitter mirror)
// ===========================================================================

async function fetchTwitter(): Promise<NewsItem[]> {
  // Try multiple Twitter RSS mirrors — xcancel first (preferred by user),
  // then Nitter as fallback. xcancel requires reader whitelist so it may
  // return "not yet whitelisted" — we detect that and try next instance.
  const instances = [
    { host: "rss.xcancel.com", path: (h: string) => `https://rss.xcancel.com/${h}/rss` },
    { host: "nitter.net", path: (h: string) => `https://nitter.net/${h}/rss` },
    { host: "nitter.tiekoetter.com", path: (h: string) => `https://nitter.tiekoetter.com/${h}/rss` },
  ];
  const accounts = [
    { handle: "CClarkReport", name: "@CClarkReport" },
    { handle: "kenswift", name: "@kenswift" },
  ];

  const items: NewsItem[] = [];
  for (const account of accounts) {
    for (const instance of instances) {
      try {
        const url = instance.path(account.handle);
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
        });
        if (!res.ok) continue;
        const xml = await res.text();
        // Validate it's a real feed (skip xcancel whitelist page)
        if (!xml.includes("<item>") || xml.includes("not yet whitelisted")) continue;

        const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const block of itemBlocks.slice(0, 25)) {
          const titleMatch =
            block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
            block.match(/<title>([\s\S]*?)<\/title>/);
          const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
          const linkMatch = block.match(/<link>(.*?)<\/link>/);

          let title = titleMatch?.[1]?.trim();
          if (!title || title.length < 15) continue;

          // Collapse whitespace
          title = title.replace(/\s+/g, " ").trim();

          items.push({
            title,
            source: account.name,
            type: "twitter",
            date: dateMatch?.[1]?.slice(0, 16),
            url: linkMatch?.[1],
          });
        }
        break; // instance worked, skip remaining instances for this account
      } catch { /* try next instance */ }
    }
  }
  return items;
}

// ===========================================================================
// Outlet coverage via Google News site search (SI, ClutchPoints, Athlon)
// ===========================================================================

async function fetchOutletNews(): Promise<NewsItem[]> {
  const outlets = [
    { query: "%22Sports+Illustrated%22+caitlin+clark+OR+fever", source: "Sports Illustrated" },
    { query: "%22ClutchPoints%22+caitlin+clark+OR+fever+OR+wnba", source: "ClutchPoints" },
    { query: "%22Athlon+Sports%22+caitlin+clark+OR+fever", source: "Athlon Sports" },
  ];

  const items: NewsItem[] = [];
  for (const outlet of outlets) {
    try {
      const url = `https://news.google.com/rss/search?q=${outlet.query}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const block of itemBlocks.slice(0, 15)) {
        const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/);
        const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
        const rawTitle = titleMatch?.[1]?.trim() || "";
        if (!rawTitle || rawTitle.length < 15) continue;

        // Google News titles often end with " - Outlet Name" — strip that
        const title = rawTitle.replace(/\s*[-–—]\s*[^-–—]+$/, "").trim();
        if (!title || title.length < 10) continue;

        items.push({
          title,
          source: outlet.source,
          type: "news",
          date: dateMatch?.[1]?.slice(0, 16),
        });
      }
    } catch { /* continue */ }
  }
  return items;
}

// ===========================================================================
// General Google News (fallback / broader net)
// ===========================================================================

async function fetchGoogleNews(): Promise<NewsItem[]> {
  const queries = [
    '"caitlin clark"',
    '"indiana fever"',
    '"caitlin clark" controversy OR quote OR responds',
  ];

  const items: NewsItem[] = [];
  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const block of itemBlocks.slice(0, 8)) {
        const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/);
        const sourceMatch = block.match(/<source[^>]*>([^<]+)<\/source>/);
        const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);

        const title = titleMatch?.[1]?.trim();
        if (!title || title.length < 15) continue;

        items.push({
          title,
          source: sourceMatch?.[1]?.trim() || "Google News",
          type: "news",
          date: dateMatch?.[1]?.slice(0, 16),
        });
      }
    } catch { /* continue */ }
  }
  return items;
}

// ===========================================================================
// Aggregator — formats everything for the AI prompt
// ===========================================================================

export async function fetchAllNewsSources(): Promise<string> {
  const [journalism, twitter, outlet, gnews, competitors] = await Promise.all([
    fetchYouTubeJournalism(),
    fetchTwitter(),
    fetchOutletNews(),
    fetchGoogleNews(),
    fetchYouTubeCompetitors(),
  ]);

  const seen = new Set<string>();
  const dedupe = (items: NewsItem[]): NewsItem[] =>
    items.filter((i) => {
      const key = i.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const sections: string[] = [];

  const uniqJournalism = dedupe(journalism).slice(0, 80);
  if (uniqJournalism.length) {
    sections.push("=== WNBA JOURNALISM VIDEOS (Mick Talks Hoops + Rachel DeMita — PRIMARY STORYLINE SOURCE) ===");
    sections.push(
      uniqJournalism
        .map((i, n) => {
          const base = `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`;
          return i.snippet ? `${base}\n   ↳ ${i.snippet.slice(0, 180)}` : base;
        })
        .join("\n")
    );
  }

  const uniqTwitter = dedupe(twitter).slice(0, 50);
  if (uniqTwitter.length) {
    sections.push("\n=== TWITTER / X (Clark Report + Ken Swift — breaking takes and drama) ===");
    sections.push(
      uniqTwitter
        .map((i, n) => `${n + 1}. ${i.source}: "${i.title}"${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  const uniqOutlet = dedupe(outlet).slice(0, 20);
  if (uniqOutlet.length) {
    sections.push("\n=== OUTLET DEEP COVERAGE (SI, ClutchPoints, Athlon Sports) ===");
    sections.push(
      uniqOutlet
        .map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  const uniqGnews = dedupe(gnews).slice(0, 15);
  if (uniqGnews.length) {
    sections.push("\n=== GENERAL MAINSTREAM NEWS (Google News) ===");
    sections.push(
      uniqGnews
        .map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  const uniqCompetitors = dedupe(competitors).slice(0, 15);
  if (uniqCompetitors.length) {
    sections.push("\n=== COMPETITOR CC CHANNELS (what they're covering — don't copy, but see what's resonating) ===");
    sections.push(
      uniqCompetitors
        .map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  if (sections.length === 0) {
    return "No news could be fetched. Fall back to evergreen Caitlin Clark career moments.";
  }

  return sections.join("\n");
}
