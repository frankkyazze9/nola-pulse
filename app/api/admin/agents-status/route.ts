import { NextResponse } from "next/server";
import { Firestore } from "@google-cloud/firestore";

const firestore = new Firestore({
  projectId: "nola-ai-innovation",
  databaseId: "agents",
});

export async function GET() {
  const snap = await firestore.collection("agents").get();
  const agents = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(agents);
}
