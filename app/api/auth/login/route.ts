import { NextResponse } from "next/server";
import {
  passwordsMatch,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
} from "@/lib/dashboard-auth";

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "Dashboard password is not set." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  let provided = "";
  let next = "/";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { password?: unknown; next?: unknown } | null;
    provided = typeof body?.password === "string" ? body.password : "";
    next = typeof body?.next === "string" ? safeNextPath(body.next) : "/";
  } else {
    const form = await request.formData();
    provided = String(form.get("password") ?? "");
    next = safeNextPath(String(form.get("next") ?? ""));
  }

  if (!passwordsMatch(provided, password)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, await signSession(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
