import { videos } from "@/lib/data";
import Link from "next/link";
import { ArrowLeft, Clock, Tag } from "lucide-react";
import { notFound } from "next/navigation";

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

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = videos.find((v) => v.id === parseInt(id));

  if (!video) notFound();

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${statusColors[video.status]}`}>
            {video.status}
          </span>
          <span className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${categoryColors[video.category] || "bg-gray-500/10 text-gray-400"}`}>
            {video.category.replace("-", " ")}
          </span>
          <span className="flex items-center gap-1.5 text-gray-500 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {video.estimatedLength}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
          {video.title}
        </h1>

        <p className="text-lg text-gray-400 leading-relaxed mb-6">
          {video.hookLine}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {video.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#121217] border border-[#22222b] text-gray-400 text-xs">
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Thumbnail Concept */}
      <div className="p-6 rounded-xl bg-[#121217] border border-[#22222b] mb-8">
        <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Thumbnail Concept</h2>
        <p className="text-gray-300 leading-relaxed">{video.thumbnailConcept}</p>
      </div>

      {/* Script */}
      {video.script ? (
        <div className="p-6 md:p-8 rounded-xl bg-[#121217] border border-[#22222b]">
          <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-6">Full Script</h2>
          <div className="prose prose-invert max-w-none">
            {video.script.split("\n").map((line, i) => {
              if (line.startsWith("[") && line.endsWith("]")) {
                return (
                  <h3 key={i} className="text-purple-300 font-bold text-lg mt-8 mb-3 first:mt-0">
                    {line}
                  </h3>
                );
              }
              if (line.trim() === "") return <div key={i} className="h-3" />;
              return (
                <p key={i} className="text-gray-300 leading-relaxed mb-2 text-[15px]">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-xl bg-[#121217] border border-[#22222b] text-center">
          <p className="text-gray-500 text-lg">No script written yet.</p>
          <p className="text-gray-600 text-sm mt-2">This video is still in the idea phase.</p>
        </div>
      )}
    </div>
  );
}
