import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CouncilMeetingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const meeting = await prisma.councilMeeting.findUnique({
    where: { slug },
  });

  if (!meeting || meeting.status !== "summarized") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <article>
        <h1 className="mb-2 text-3xl font-bold">{meeting.title}</h1>
        <p className="mb-8 text-sm text-muted">
          {new Date(meeting.meetingDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <div className="whitespace-pre-wrap leading-relaxed">
          {meeting.summary}
        </div>
      </article>
    </div>
  );
}
