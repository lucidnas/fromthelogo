// Multi-source news aggregator for Caitlin Clark / WNBA stories.
// Pulls from Google News, Reddit, competitor YouTube channels, and RSS feeds
// to find both mainstream coverage AND fan-community storylines.

export type NewsItem = {
  title: string;
  source: string;
  type: "news" | "reddit" | "youtube" | "rss";
  date?: string;
  url?: string;
  snippet?: string;
  score?: number; // upvotes for reddit, views for youtube
};

// ===========================================================================
// Google News RSS
// ===========================================================================

async function fetchGoogleNews(): Promise<NewsItem[]> {
  const queries = [
    '"caitlin clark"',
    '"indiana fever"',
    '"caitlin clark" controversy OR drama',
    '"caitlin clark" quote OR says OR responds',
    '"sophie cunningham" OR "aliyah boston"',
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

      for (const block of itemBlocks.slice(0, 10)) {
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
// Reddit (no auth needed via .json endpoints)
// ===========================================================================

async function fetchReddit(): Promise<NewsItem[]> {
  const subs = [
    { name: "CaitlinClark", sort: "hot", limit: 15 },
    { name: "wnba", sort: "hot", limit: 15 },
    { name: "fever", sort: "hot", limit: 10 },
    { name: "wnbadiscussion", sort: "hot", limit: 10 },
  ];

  const items: NewsItem[] = [];
  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub.name}/${sub.sort}.json?limit=${sub.limit}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "from-the-logo-bot/1.0" },
      });
      if (!res.ok) continue;
      const data = await res.json();

      for (const child of data?.data?.children || []) {
        const post = child.data;
        if (!post?.title) continue;

        // Skip mega-threads and low effort
        if (post.score < 5) continue;
        if (post.stickied) continue;

        const title = post.title.trim();
        const selftext = (post.selftext || "").slice(0, 200);

        items.push({
          title,
          source: `r/${sub.name}`,
          type: "reddit",
          score: post.score,
          url: `https://reddit.com${post.permalink}`,
          snippet: selftext,
        });
      }
    } catch { /* continue */ }
  }
  return items.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 30);
}

// ===========================================================================
// YouTube competitors — recent video titles
// ===========================================================================

async function fetchYouTubeCompetitors(): Promise<NewsItem[]> {
  // Use YouTube RSS feeds (no API key required)
  const channels = [
    { id: "UCvWdLRqA7R2Gggisxn4Xkhg", name: "From The Logo" }, // the user's own channel
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
        const viewsMatch = entry.match(/views="(\d+)"/);

        const title = titleMatch?.[1]?.trim();
        if (!title) continue;

        // Filter for CC/WNBA/Fever content
        const lower = title.toLowerCase();
        if (!lower.includes("caitlin") && !lower.includes("clark") &&
            !lower.includes("wnba") && !lower.includes("fever") &&
            !lower.includes("indiana")) continue;

        items.push({
          title,
          source: channel.name,
          type: "youtube",
          date: publishedMatch?.[1]?.slice(0, 10),
          score: viewsMatch ? parseInt(viewsMatch[1]) : 0,
        });
      }
    } catch { /* continue */ }
  }
  return items;
}

// ===========================================================================
// RSS feeds from specific outlets
// ===========================================================================

async function fetchOutletRSS(): Promise<NewsItem[]> {
  const feeds = [
    { url: "https://www.si.com/.rss/full/", name: "Sports Illustrated" },
    { url: "https://clutchpoints.com/wnba/feed", name: "ClutchPoints WNBA" },
    { url: "https://www.bleacherreport.com/articles/feed?tag_id=1020", name: "Bleacher Report WNBA" },
  ];

  const items: NewsItem[] = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const block of itemBlocks.slice(0, 15)) {
        const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/);
        const title = titleMatch?.[1]?.trim();
        if (!title || title.length < 15) continue;

        // Only keep CC/Fever/WNBA related
        const lower = title.toLowerCase();
        if (!lower.includes("caitlin") && !lower.includes("clark") &&
            !lower.includes("wnba") && !lower.includes("fever") &&
            !lower.includes("indiana")) continue;

        items.push({
          title,
          source: feed.name,
          type: "rss",
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
  const [gnews, reddit, youtube, rss] = await Promise.all([
    fetchGoogleNews(),
    fetchReddit(),
    fetchYouTubeCompetitors(),
    fetchOutletRSS(),
  ]);

  // Dedupe by title
  const seen = new Set<string>();
  const dedupe = (items: NewsItem[]): NewsItem[] =>
    items.filter((i) => {
      const key = i.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const sections: string[] = [];

  const uniqGnews = dedupe(gnews).slice(0, 15);
  if (uniqGnews.length) {
    sections.push("=== MAINSTREAM NEWS (Google News) ===");
    sections.push(uniqGnews.map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`).join("\n"));
  }

  const uniqRss = dedupe(rss).slice(0, 10);
  if (uniqRss.length) {
    sections.push("\n=== OUTLET DEEP COVERAGE (SI, ClutchPoints, BR) ===");
    sections.push(uniqRss.map((i, n) => `${n + 1}. "${i.title}" — ${i.source}`).join("\n"));
  }

  const uniqReddit = dedupe(reddit).slice(0, 25);
  if (uniqReddit.length) {
    sections.push("\n=== FAN COMMUNITY DISCUSSION (Reddit) ===");
    sections.push(
      uniqReddit
        .map((i, n) => `${n + 1}. [${i.score}↑] "${i.title}" — ${i.source}${i.snippet ? ` | ${i.snippet.slice(0, 120)}...` : ""}`)
        .join("\n")
    );
  }

  const uniqYoutube = dedupe(youtube).slice(0, 15);
  if (uniqYoutube.length) {
    sections.push("\n=== COMPETITOR VIDEO TITLES (what other CC channels are covering) ===");
    sections.push(
      uniqYoutube.map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`).join("\n")
    );
  }

  if (sections.length === 0) {
    return "No news could be fetched from any source. Fall back to evergreen Caitlin Clark career moments.";
  }

  return sections.join("\n");
}
