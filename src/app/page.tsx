"use client";
import { useState } from "react";
import Link from "next/link";
import { videos, type Video } from "@/lib/data";
import { Clock, FileText, Zap } from "lucide-react";

const categories = ["all", "game-breakdown", "analysis", "rivalry", "controversy", "highlights", "career-story"];
const statuses = ["all", "idea", "scripted", "filmed", "published"];

const statusColors: Record<string, string> = {
  idea: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const categoryColors: Record<string, string> = {
  "game-breakdown": "bg-red-500/10 text-red-400",
  analysis: "bg-blue-500/10 text-blue-400",
  rivalry: "bg-amber-500/10 text-amber-400",
  controversy: "bg-rose-500/10 text-rose-400",
  highlights: "bg-emerald-500/10 text-emerald-400",
  "career-story": "bg-violet-500/10 text-violet-400",
};

export default function Home() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = videos.filter((v) => {
    if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    return true;
  });

  const scripted = videos.filter((v) => v.script).length;
  const ideas = videos.filter((v) => !v.script).length;

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-gray-400">Total Videos</span>
          </div>
          <span className="text-3xl font-bold text-white">{videos.length}</span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-gray-400">Scripted</span>
          </div>
          <span className="text-3xl font-bold text-white">{scripted}</span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-gray-400">Ideas</span>
          </div>
          <span className="text-3xl font-bold text-white">{ideas}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${categoryFilter === c ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-[#121217] text-gray-400 border border-[#22222b] hover:text-white"}`}>
              {c === "all" ? "All Categories" : c.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-[#121217] text-gray-400 border border-[#22222b] hover:text-white"}`}>
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-500">No videos match your filters.</div>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/video/${video.id}`}
      className="group block p-6 rounded-xl bg-[#121217] border border-[#22222b] hover:border-purple-500/30 hover:bg-[#16161d] transition-all duration-300">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${statusColors[video.status]}`}>
          {video.status}
        </span>
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium capitalize ${categoryColors[video.category] || "bg-gray-500/10 text-gray-400"}`}>
          {video.category.replace("-", " ")}
        </span>
      </div>
      <h3 className="font-semibold text-white text-lg leading-snug mb-3 group-hover:text-purple-300 transition-colors">
        {video.title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
        {video.hookLine}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-600 text-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>{video.estimatedLength}</span>
        </div>
        {video.script && (
          <span className="text-purple-400 text-xs font-medium">Script ready →</span>
        )}
      </div>
    </Link>
  );
}
