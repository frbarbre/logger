import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Only run this middleware on protected routes
  if (!request.nextUrl.pathname.startsWith("/login")) {
    const authCookie = request.cookies.get("pb_auth");

    // If there's no auth cookie, redirect to login page
    if (!authCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // If there is an auth cookie, we'll let the request through
    // The actual session validation should be done in your API routes or server components
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
