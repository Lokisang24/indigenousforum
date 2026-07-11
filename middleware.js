import { NextResponse } from "next/server";

// Lightweight edge check: just confirms the auth cookie is present before
// letting the page render. Full JWT verification happens in the API routes
// (jsonwebtoken isn't edge-runtime friendly), so this is a first line of
// defense that avoids flashing the dashboard UI to logged-out visitors.
export function middleware(req) {
  const token = req.cookies.get("if_admin_token");

  if (!token) {
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard"],
};
