import { NextResponse, type NextRequest } from "next/server";
import { isOpenPath, SESSION_COOKIE, sessionMatches } from "@/lib/dashboard-auth";

export async function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();

  const allowed = await sessionMatches(request.cookies.get(SESSION_COOKIE)?.value, password);
  if (allowed) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
