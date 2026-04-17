"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { videos, type Video } from "@/lib/data";
import { Clock, FileText, Zap, Calendar, Target } from "lucide-react";

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

interface CalendarSlotData {
  id: number;
  dayOfWeek: string;
  slotType: string;
  date: string;
  status: string;
  pitch: { title: string; hookLine: string } | null;
}

const calendarStatusColors: Record<string, string> = {
  open: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  planned: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function Home() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [weekSlots, setWeekSlots] = useState<CalendarSlotData[]>([]);
  const [monthlyPublished, setMonthlyPublished] = useState(0);

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const now = new Date();
        // Get this week's slots
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const res = await fetch(
          `/api/calendar?startDate=${monday.toISOString()}&endDate=${sunday.toISOString()}`
        );
        const data = await res.json();
        setWeekSlots(data.slots || []);

        // Monthly count
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthRes = await fetch(
          `/api/calendar?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`
        );
        const monthData = await monthRes.json();
        setMonthlyPublished(
          (monthData.slots || []).filter((s: CalendarSlotData) => s.status === "published").length
        );
      } catch {
        // Calendar data not critical for dashboard
      }
    }
    fetchCalendar();
  }, []);

  const filtered = videos.filter((v) => {
    if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    return true;
  });

  const scripted = videos.filter((v) => v.script).length;
  const ideas = videos.filter((v) => !v.script).length;

  const mondaySlot = weekSlots.find((s) => s.dayOfWeek === "monday");
  const thursdaySlot = weekSlots.find((s) => s.dayOfWeek === "thursday");

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* This Week Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">This Week</h2>
          </div>
          <Link
            href="/calendar"
            className="text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            View Calendar &rarr;
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Monday Slot */}
          <div className={`p-4 rounded-xl bg-[#121217] border ${mondaySlot ? "border-orange-500/20" : "border-[#22222b]"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                Monday
              </span>
              {mondaySlot && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${calendarStatusColors[mondaySlot.status]}`}>
                  {mondaySlot.status}
                </span>
              )}
            </div>
            {mondaySlot?.pitch ? (
              <p className="text-sm text-white font-medium truncate">{mondaySlot.pitch.title}</p>
            ) : (
              <p className="text-sm text-gray-600">{mondaySlot ? "No pitch assigned" : "No slot"}</p>
            )}
          </div>

          {/* Thursday Slot */}
          <div className={`p-4 rounded-xl bg-[#121217] border ${thursdaySlot ? "border-emerald-500/20" : "border-[#22222b]"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Thursday
              </span>
              {thursdaySlot && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${calendarStatusColors[thursdaySlot.status]}`}>
                  {thursdaySlot.status}
                </span>
              )}
            </div>
            {thursdaySlot?.pitch ? (
              <p className="text-sm text-white font-medium truncate">{thursdaySlot.pitch.title}</p>
            ) : (
              <p className="text-sm text-gray-600">{thursdaySlot ? "No pitch assigned" : "No slot"}</p>
            )}
          </div>

          {/* Monthly Progress */}
          <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                This Month
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{monthlyPublished}</span>
              <span className="text-sm text-gray-500">/ 8 videos</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#22222b] mt-2">
              <div
                className="h-1.5 rounded-full bg-purple-500 transition-all"
                style={{ width: `${Math.min((monthlyPublished / 8) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

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
