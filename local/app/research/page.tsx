import { listResearch } from "@/lib/studio";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const items = listResearch();

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "var(--sub)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <ChevronLeft size={14} /> Videos
        </Link>
        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Research</span>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Research Briefs</h1>
          <span style={{ fontSize: 12, color: "var(--sub)" }}>Save to /Volumes/SSK SSD/ftl/research/YYYY-MM-DD-slug.md</span>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📰</div>
            <p style={{ color: "var(--sub)", fontSize: 14 }}>No research yet. Run <code style={{ color: "var(--accent)" }}>/ftl-research</code> to generate pitches.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((item) => (
              <div key={item.name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: "var(--sub)", marginLeft: "auto" }}>{item.date}</span>
                </div>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.7, color: "var(--sub)", margin: 0 }}>
                  {item.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
