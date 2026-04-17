import { videos } from "@/lib/data";
import Link from "next/link";
import { notFound } from "next/navigation";
import VideoDetail from "./VideoDetail";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = videos.find((v) => v.id === parseInt(id));
  if (!video) notFound();
  return <VideoDetail video={video} />;
}
