import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
          Affordable African digital infrastructure
        </p>
        <h1 className="max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
          Build your organisation’s digital home without expensive technology.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Ubuntu Africa Cloud is being built as a managed platform for small
          businesses, churches, schools, artists and community organisations.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950"
          >
            Join the pilot
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold"
          >
            View dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
