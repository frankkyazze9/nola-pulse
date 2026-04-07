import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check handled by middleware for all /admin/* except /admin/login
  return <>{children}</>;
}
