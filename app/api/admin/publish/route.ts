import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Firestore } from "@google-cloud/firestore";

const firestore = new Firestore({
  projectId: "nola-ai-innovation",
  databaseId: "agents",
});

export async function POST(request: Request) {
  const { contentId } = await request.json();

  if (!contentId) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  // Get the draft from Firestore
  const doc = await firestore.doc(`content-queue/${contentId}`).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const draft = doc.data()!;
  const today = new Date().toISOString().split("T")[0];
  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  // Save to Cloud SQL for public display
  const article = await prisma.article.upsert({
    where: { slug },
    update: {
      title: draft.title,
      body: draft.body,
      status: "published",
      publishedAt: new Date(),
    },
    create: {
      slug,
      title: draft.title,
      body: draft.body,
      topic: draft.type === "article" ? "daily" : draft.type,
      status: "published",
      publishedAt: new Date(),
    },
  });

  // Update Firestore status
  await firestore.doc(`content-queue/${contentId}`).update({
    status: "published",
    publishedAt: new Date().toISOString(),
    publishedSlug: slug,
  });

  return NextResponse.json({ id: article.id, slug: article.slug });
}
