import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isLoginPage = req.nextUrl.pathname === "/admin/login";
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");

  // Don't protect login page or auth API
  if (isLoginPage || isAuthApi) {
    return NextResponse.next();
  }

  // Protect all admin routes
  if (isAdmin && !req.auth) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
