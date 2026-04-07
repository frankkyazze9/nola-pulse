import { NextResponse } from "next/server";
import { summarizeCouncilMeeting } from "@/pipelines/council-ingest";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const { transcript, meetingDate, title } = await request.json();

  if (!transcript || !meetingDate) {
    return NextResponse.json(
      { error: "transcript and meetingDate are required" },
      { status: 400 }
    );
  }

  const summary = await summarizeCouncilMeeting(transcript);
  const slug = `meeting-${meetingDate}`;

  const meeting = await prisma.councilMeeting.upsert({
    where: { slug },
    update: { rawTranscript: transcript, summary, status: "summarized" },
    create: {
      meetingDate: new Date(meetingDate),
      title: title || `Council Meeting — ${meetingDate}`,
      slug,
      rawTranscript: transcript,
      summary,
      status: "summarized",
    },
  });

  return NextResponse.json({ id: meeting.id, slug: meeting.slug, summary });
}
