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

// Scrape a YouTube channel page HTML to get recent video titles (up to ~30).
// Works without cookies for public channels.
async function scrapeYouTubeChannel(channelId: string, channelName: string, limit: number): Promise<NewsItem[]> {
  try {
    const url = `https://www.youtube.com/channel/${channelId}/videos`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract the ytInitialData JSON embedded in the page
    const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const videosTab = tabs.find((t: any) =>
      t?.tabRenderer?.content?.richGridRenderer
    );
    const contents: any[] = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || [];

    const items: NewsItem[] = [];
    for (const c of contents.slice(0, limit)) {
      const video = c?.richItemRenderer?.content?.videoRenderer;
      if (!video) continue;
      const title = video?.title?.runs?.[0]?.text || video?.title?.simpleText;
      const publishedText = video?.publishedTimeText?.simpleText;
      const viewCountText = video?.viewCountText?.simpleText || video?.shortViewCountText?.simpleText;

      if (!title) continue;

      items.push({
        title: title.trim(),
        source: channelName,
        type: "youtube",
        date: publishedText || "",
        score: viewCountText
          ? parseInt(viewCountText.replace(/[^0-9]/g, "")) || 0
          : 0,
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchYouTubeCompetitors(): Promise<NewsItem[]> {
  // Mick Talks Hoops covers WNBA hourly — use the page scraper to get ~100 videos.
  // Rachel DeMita also uploads frequently — scrape for more history.
  // Other channels use RSS (15 latest, sufficient for narrative channels).
  const scrapeChannels = [
    { id: "UCcT4c8glrjIO0pIVzJ6BWbg", name: "Mick Talks Hoops", limit: 100 },
    { id: "UCBS2RdExOLDYVLnfsZ2Q4-w", name: "Rachel DeMita", limit: 30 },
  ];

  const rssChannels = [
    { id: "UCvWdLRqA7R2Gggisxn4Xkhg", name: "From The Logo", filterCC: false, pullCount: 10 },
    { id: "UCYZOGKxkcE3BUwF5HfuzP1w", name: "Hoop Reports", filterCC: true, pullCount: 10 },
    { id: "UCj7OqYE9cNEzT6y_-Z3BdbA", name: "Basketball Top Stories", filterCC: true, pullCount: 10 },
  ];

  // Run scrapers in parallel
  const scraped = await Promise.all(
    scrapeChannels.map((c) => scrapeYouTubeChannel(c.id, c.name, c.limit))
  );
  const items: NewsItem[] = scraped.flat();

  for (const channel of rssChannels) {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      for (const entry of entries.slice(0, channel.pullCount)) {
        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
        const viewsMatch = entry.match(/views="(\d+)"/);

        const title = titleMatch?.[1]?.trim();
        if (!title) continue;

        if (channel.filterCC) {
          // Filter for CC/WNBA/Fever content
          const lower = title.toLowerCase();
          if (
            !lower.includes("caitlin") &&
            !lower.includes("clark") &&
            !lower.includes("wnba") &&
            !lower.includes("fever") &&
            !lower.includes("indiana")
          ) {
            continue;
          }
        }

        items.push({
          title,
          source: channel.name,
          type: "youtube",
          date: publishedMatch?.[1]?.slice(0, 10),
          score: viewsMatch ? parseInt(viewsMatch[1]) : 0,
        });
      }
    } catch {
      /* continue */
    }
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

  // Split YouTube into journalism channels (Mick/Rachel — real-time WNBA news)
  // vs. narrative competitor channels (Hoop Reports/BTS/FTL — what they're covering)
  const journalismChannels = new Set(["Mick Talks Hoops", "Rachel DeMita"]);
  const uniqYoutubeJournalism = dedupe(youtube.filter((i) => journalismChannels.has(i.source))).slice(0, 60);
  const uniqYoutubeCompetitor = dedupe(youtube.filter((i) => !journalismChannels.has(i.source))).slice(0, 20);

  if (uniqYoutubeJournalism.length) {
    sections.push("\n=== WNBA JOURNALISM VIDEOS (Mick Talks Hoops, Rachel DeMita — trending storylines) ===");
    sections.push(
      uniqYoutubeJournalism
        .map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  if (uniqYoutubeCompetitor.length) {
    sections.push("\n=== COMPETITOR VIDEO TITLES (what other CC channels are covering) ===");
    sections.push(
      uniqYoutubeCompetitor
        .map((i, n) => `${n + 1}. "${i.title}" — ${i.source}${i.date ? ` (${i.date})` : ""}`)
        .join("\n")
    );
  }

  if (sections.length === 0) {
    return "No news could be fetched from any source. Fall back to evergreen Caitlin Clark career moments.";
  }

  return sections.join("\n");
}
