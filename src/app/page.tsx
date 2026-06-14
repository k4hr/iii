const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "iii";

const startingPoints = [
  "Shape the first user journey",
  "Add the domain model when it is real",
  "Ship a small vertical slice",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <span className="text-sm font-semibold tracking-[0.28em] uppercase">
          {appName}
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
          Ready to build
        </span>
      </header>

      <section className="flex flex-1 items-center py-20">
        <div className="grid w-full gap-14 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <p className="mb-5 text-sm font-medium text-indigo-300">
              Next.js + TypeScript + Tailwind
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.05em] sm:text-7xl lg:text-8xl">
              Start with the idea, not the setup.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400 sm:text-xl">
              The foundation is in place. Replace this screen with the first
              useful feature and let the architecture grow from real needs.
            </p>
          </div>

          <ol className="space-y-3">
            {startingPoints.map((item, index) => (
              <li
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-300 backdrop-blur"
                key={item}
              >
                <span className="text-zinc-600">0{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-white/10 pt-6 text-xs text-zinc-600">
        Edit src/app/page.tsx to begin.
      </footer>
    </main>
  );
}
