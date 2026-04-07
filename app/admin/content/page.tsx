import { ContentQueue } from "@/components/admin/ContentQueue";
import Link from "next/link";

export default function ContentPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin" className="text-muted hover:text-foreground">
          &larr; Command Center
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Content</span> Queue
      </h1>
      <p className="mb-8 text-muted">
        Review, approve, edit, and publish AI-generated content. Agents submit
        drafts here for your approval before anything goes live.
      </p>

      <ContentQueue />
    </div>
  );
}
