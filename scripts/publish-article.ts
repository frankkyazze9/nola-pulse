import { Firestore } from "@google-cloud/firestore";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const contentId = process.argv[2] || "AcvDpBIg4zXxzECzJXsf";

async function main() {
  const fs = new Firestore({ projectId: "nola-ai-innovation", databaseId: "agents" });
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const doc = await fs.doc(`content-queue/${contentId}`).get();
  if (!doc.exists) { console.log("Draft not found"); return; }

  const draft = doc.data()!;
  const slug = draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  const article = await prisma.article.create({
    data: { slug, title: draft.title, body: draft.body, topic: "daily", status: "published", publishedAt: new Date() },
  });

  await fs.doc(`content-queue/${contentId}`).update({ status: "published", publishedAt: new Date().toISOString() });
  console.log(`Published: /articles/${article.slug}`);
  await prisma.$disconnect();
}

main().catch(console.error);
