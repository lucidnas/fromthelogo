"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Target,
  FileText,
  Clock,
  Check,
  X,
} from "lucide-react";

interface Pitch {
  id: number;
  title: string;
  hookLine: string;
  format: string;
  status: string;
}

interface CalendarSlot {
  id: number;
  weekNumber: number;
  year: number;
  dayOfWeek: string;
  slotType: string;
  date: string;
  pitchId: number | null;
  pitch: Pitch | null;
  videoId: number | null;
  status: string;
  notes: string | null;
}

const statusColors: Record<string, string> = {
  open: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  planned: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const statusOrder = ["open", "planned", "scripted", "filmed", "published"];

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function CalendarPage() {
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assigningSlot, setAssigningSlot] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [monthlyPublished, setMonthlyPublished] = useState(0);
  const [scriptsReady, setScriptsReady] = useState(0);

  const fetchSlots = useCallback(async () => {
    const today = new Date();
    const monday = getMondayOfWeek(today);
    monday.setDate(monday.getDate() + weekOffset * 7);

    const startDate = new Date(monday);
    const endDate = new Date(monday);
    endDate.setDate(endDate.getDate() + 27); // 4 weeks

    const res = await fetch(
      `/api/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );
    const data = await res.json();
    setSlots(data.slots || []);

    // Count monthly published
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthRes = await fetch(
      `/api/calendar?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`
    );
    const monthData = await monthRes.json();
    const monthSlots: CalendarSlot[] = monthData.slots || [];
    setMonthlyPublished(monthSlots.filter((s) => s.status === "published").length);
    setScriptsReady(monthSlots.filter((s) => s.status === "scripted").length);

    setLoading(false);
  }, [weekOffset]);

  const fetchPitches = useCallback(async () => {
    const res = await fetch("/api/pitches?status=accepted");
    const data = await res.json();
    setPitches(data.pitches || []);
  }, []);

  useEffect(() => {
    fetchSlots();
    fetchPitches();
  }, [fetchSlots, fetchPitches]);

  const generateSlots = async () => {
    setLoading(true);
    await fetch("/api/calendar/generate", { method: "POST" });
    await fetchSlots();
  };

  const assignPitch = async (slotId: number, pitchId: number) => {
    await fetch(`/api/calendar/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitchId }),
    });
    setAssigningSlot(null);
    await fetchSlots();
  };

  const updateStatus = async (slotId: number, status: string) => {
    await fetch(`/api/calendar/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchSlots();
  };

  const saveNotes = async (slotId: number) => {
    await fetch(`/api/calendar/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    setEditingNotes(null);
    await fetchSlots();
  };

  // Group slots by week
  const weeks: { weekLabel: string; monday?: CalendarSlot; thursday?: CalendarSlot }[] = [];
  const today = new Date();
  const baseMonday = getMondayOfWeek(today);
  baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  for (let w = 0; w < 4; w++) {
    const weekMonday = new Date(baseMonday);
    weekMonday.setDate(weekMonday.getDate() + w * 7);
    const weekNum = getISOWeekNumber(weekMonday);
    const year = weekMonday.getFullYear();

    const weekThursday = new Date(weekMonday);
    weekThursday.setDate(weekThursday.getDate() + 3);

    const mondaySlot = slots.find(
      (s) => s.weekNumber === weekNum && s.year === year && s.dayOfWeek === "monday"
    );
    const thursdaySlot = slots.find(
      (s) => s.weekNumber === weekNum && s.year === year && s.dayOfWeek === "thursday"
    );

    const label =
      w === 0 && weekOffset === 0
        ? "This Week"
        : w === 1 && weekOffset === 0
          ? "Next Week"
          : `Week of ${weekMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    weeks.push({ weekLabel: label, monday: mondaySlot, thursday: thursdaySlot });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Content Calendar</h1>
          <p className="text-gray-500 text-sm">
            Monday = News/Evergreen &middot; Thursday = Deep Dive
          </p>
        </div>
        <button
          onClick={generateSlots}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          Generate Slots
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="p-2 rounded-lg bg-[#121217] border border-[#22222b] text-gray-400 hover:text-white hover:border-purple-500/30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setWeekOffset(0)}
          className="px-4 py-2 rounded-lg bg-[#121217] border border-[#22222b] text-sm text-gray-400 hover:text-white hover:border-purple-500/30 transition-colors"
        >
          This Week
        </button>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="p-2 rounded-lg bg-[#121217] border border-[#22222b] text-gray-400 hover:text-white hover:border-purple-500/30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Calendar Grid */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading calendar...</div>
          ) : (
            weeks.map((week, i) => (
              <div key={i}>
                <h2 className="text-lg font-semibold text-white mb-3">{week.weekLabel}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <SlotCard
                    slot={week.monday}
                    day="Monday"
                    type="news-evergreen"
                    pitches={pitches}
                    assigningSlot={assigningSlot}
                    setAssigningSlot={setAssigningSlot}
                    assignPitch={assignPitch}
                    updateStatus={updateStatus}
                    editingNotes={editingNotes}
                    setEditingNotes={setEditingNotes}
                    notesDraft={notesDraft}
                    setNotesDraft={setNotesDraft}
                    saveNotes={saveNotes}
                  />
                  <SlotCard
                    slot={week.thursday}
                    day="Thursday"
                    type="deep-dive"
                    pitches={pitches}
                    assigningSlot={assigningSlot}
                    setAssigningSlot={setAssigningSlot}
                    assignPitch={assignPitch}
                    updateStatus={updateStatus}
                    editingNotes={editingNotes}
                    setEditingNotes={setEditingNotes}
                    notesDraft={notesDraft}
                    setNotesDraft={setNotesDraft}
                    saveNotes={saveNotes}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-white">Monthly Target</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {monthlyPublished}
              <span className="text-lg text-gray-500">/8</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#22222b] mt-2">
              <div
                className="h-2 rounded-full bg-purple-500 transition-all"
                style={{ width: `${Math.min((monthlyPublished / 8) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Videos published this month</p>
          </div>

          <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-medium text-white">Scripts Ready</span>
            </div>
            <span className="text-3xl font-bold text-white">{scriptsReady}</span>
            <p className="text-xs text-gray-500 mt-1">Ready to film</p>
          </div>

          <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium text-white">Upcoming</span>
            </div>
            {slots
              .filter((s) => s.status !== "published" && new Date(s.date) >= new Date())
              .slice(0, 3)
              .map((s) => (
                <div key={s.id} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">{formatDate(s.date)}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border ${statusColors[s.status]}`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            {slots.filter((s) => s.status !== "published" && new Date(s.date) >= new Date())
              .length === 0 && <p className="text-xs text-gray-500">No upcoming deadlines</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  day,
  type,
  pitches,
  assigningSlot,
  setAssigningSlot,
  assignPitch,
  updateStatus,
  editingNotes,
  setEditingNotes,
  notesDraft,
  setNotesDraft,
  saveNotes,
}: {
  slot?: CalendarSlot;
  day: string;
  type: string;
  pitches: Pitch[];
  assigningSlot: number | null;
  setAssigningSlot: (id: number | null) => void;
  assignPitch: (slotId: number, pitchId: number) => void;
  updateStatus: (slotId: number, status: string) => void;
  editingNotes: number | null;
  setEditingNotes: (id: number | null) => void;
  notesDraft: string;
  setNotesDraft: (s: string) => void;
  saveNotes: (slotId: number) => void;
}) {
  const isMonday = type === "news-evergreen";
  const borderColor = isMonday ? "border-orange-500/20" : "border-emerald-500/20";
  const hoverBorder = isMonday
    ? "hover:border-orange-500/40"
    : "hover:border-emerald-500/40";

  if (!slot) {
    return (
      <div
        className={`p-5 rounded-xl bg-[#121217] border ${borderColor} opacity-50 flex items-center justify-center min-h-[160px]`}
      >
        <div className="text-center">
          <Calendar className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            No {day} slot yet
          </p>
          <p className="text-xs text-gray-700">Click "Generate Slots" to create</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-5 rounded-xl bg-[#121217] border ${borderColor} ${hoverBorder} transition-all`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-white">{formatDate(slot.date)}</p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              isMonday
                ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {isMonday ? "News Evergreen" : "Deep Dive"}
          </span>
        </div>

        {/* Status dropdown */}
        <select
          value={slot.status}
          onChange={(e) => updateStatus(slot.id, e.target.value)}
          className="px-2 py-1 rounded-md text-xs font-medium bg-[#0b0b0f] border border-[#22222b] text-gray-300 focus:outline-none focus:border-purple-500/50 cursor-pointer"
        >
          {statusOrder.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Status badge */}
      <div className="mb-3">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[slot.status]}`}
        >
          {slot.status}
        </span>
      </div>

      {/* Pitch content or assign button */}
      {slot.pitch ? (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white mb-1">{slot.pitch.title}</h3>
          <p className="text-xs text-gray-500 line-clamp-2">{slot.pitch.hookLine}</p>
          <Link
            href={`/pitches?generate=${slot.pitch.id}`}
            className="inline-block mt-2 text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            Generate Script &rarr;
          </Link>
        </div>
      ) : (
        <div className="mb-3">
          {assigningSlot === slot.id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Select a pitch:</span>
                <button
                  onClick={() => setAssigningSlot(null)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {pitches.length === 0 ? (
                  <p className="text-xs text-gray-600 py-2">
                    No accepted pitches available.
                  </p>
                ) : (
                  pitches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => assignPitch(slot.id, p.id)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#22222b] hover:border-purple-500/30 transition-colors"
                    >
                      <p className="text-xs font-medium text-white truncate">{p.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{p.hookLine}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAssigningSlot(slot.id)}
              className="w-full px-3 py-2 rounded-lg border border-dashed border-[#22222b] text-xs text-gray-500 hover:text-white hover:border-purple-500/30 transition-colors"
            >
              + Assign a pitch
            </button>
          )}
        </div>
      )}

      {/* Notes */}
      {editingNotes === slot.id ? (
        <div className="space-y-2">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add notes..."
            className="w-full px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-xs text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/50"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveNotes(slot.id)}
              className="px-2 py-1 rounded text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-medium"
            >
              <Check className="w-3 h-3 inline mr-1" />
              Save
            </button>
            <button
              onClick={() => setEditingNotes(null)}
              className="px-2 py-1 rounded text-[10px] text-gray-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditingNotes(slot.id);
            setNotesDraft(slot.notes || "");
          }}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {slot.notes ? (
            <span className="text-gray-500">{slot.notes}</span>
          ) : (
            "Add notes..."
          )}
        </button>
      )}
    </div>
  );
}
