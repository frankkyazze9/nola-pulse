import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  const meetings = await prisma.councilMeeting.findMany({
    where: { status: "summarized" },
    orderBy: { meetingDate: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Council</span> Whisperer
      </h1>
      <p className="mb-8 text-muted">
        AI-generated summaries of New Orleans City Council meetings. What they
        decided, how they voted, and what it means for you — in plain language.
      </p>

      {meetings.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="mb-4 text-lg font-semibold">No meetings summarized yet</p>
          <p className="text-muted">
            Council meeting transcripts are being ingested and summarized. Check
            back soon.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/council/${meeting.slug}`}
              className="group rounded-xl border border-card-border bg-card-bg p-6 transition-colors hover:border-accent"
            >
              <h2 className="mb-1 text-lg font-semibold group-hover:text-accent">
                {meeting.title}
              </h2>
              <p className="mb-3 text-sm text-muted">
                {new Date(meeting.meetingDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {meeting.summary && (
                <p className="text-sm text-muted">
                  {meeting.summary.slice(0, 200).replace(/[#*_]/g, "")}...
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
