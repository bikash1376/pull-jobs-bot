import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-6">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">AgentApply</h1>
        <p className="mt-3 text-zinc-600">
          Telegram bot for remote job search via Remotive, tailored resumes, and application tracking.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/admin"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Admin dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
