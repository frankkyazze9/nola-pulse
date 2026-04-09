import { NextResponse } from "next/server";
import { Firestore } from "@google-cloud/firestore";

const firestore = new Firestore({
  projectId: "nola-ai-innovation",
  databaseId: "agents",
});

export async function GET() {
  const snap = await firestore
    .collection("content-queue")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(items);
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  await firestore.doc(`content-queue/${id}`).update({
    status,
    reviewedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
