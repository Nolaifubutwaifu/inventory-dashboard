import { Suspense } from "react";
import { connection } from "next/server";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  await connection();
  const query = await searchParams;
  const password = process.env.DASHBOARD_PASSWORD;
  const failed = first(query.error) === "1";
  const next = first(query.next) ?? "";

  return (
    <LoginShell>
      {password ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Enter the dashboard password to view stock and sales.
          </p>
          <form
            method="post"
            action="/api/auth/login"
            className="mt-6 rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <label className="block text-[13px] font-medium text-neutral-700" htmlFor="password">
              Password
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-normal text-neutral-900"
              />
            </label>
            {failed ? (
              <p className="mt-3 text-[13px] text-[#9a3412]">That password did not match.</p>
            ) : null}
            <button
              type="submit"
              className="mt-4 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              Continue
            </button>
          </form>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          A password is not set for this dashboard. The stock matrix is open.
        </p>
      )}
    </LoginShell>
  );
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-neutral-400">BRISBINS</p>
      <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-neutral-900">
        Dashboard login
      </h1>
      {children}
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
