import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Implement automated council transcript fetching
  // For now, council summaries are created via the admin panel
  return NextResponse.json({
    status: "not_implemented",
    message: "Use admin panel to paste transcripts manually",
  });
}
