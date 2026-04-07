import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const posts = await prisma.forumPost.findMany({
    orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const body = await request.json();

  const { title, content, authorName, authorEmail } = body;

  if (!title || !content || !authorName) {
    return NextResponse.json(
      { error: "title, content, and authorName are required" },
      { status: 400 }
    );
  }

  const post = await prisma.forumPost.create({
    data: {
      title,
      body: content,
      authorName,
      authorEmail: authorEmail || null,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
