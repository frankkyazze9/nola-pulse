import { NextResponse } from "next/server";
import { generateDailyArticle } from "@/pipelines/daily-article";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const article = await generateDailyArticle();
  const today = new Date().toISOString().split("T")[0];
  const slug = `daily-${today}`;

  const saved = await prisma.article.create({
    data: {
      slug,
      title: `NOLA Pulse Daily — ${today}`,
      body: article.body,
      topic: "daily",
      status: "draft",
    },
  });

  return NextResponse.json({ id: saved.id, slug: saved.slug });
}
