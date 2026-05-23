export default function DocumentLoading() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <section className="rounded-md border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-200/60 sm:px-7 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="grid flex-1 gap-3">
            <div className="h-6 w-28 animate-pulse rounded-md bg-slate-100" />
            <div className="h-10 w-80 max-w-full animate-pulse rounded-md bg-slate-200" />
            <div className="h-5 w-full max-w-2xl animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-md bg-slate-100" />
            <div className="h-9 w-24 animate-pulse rounded-md bg-slate-100" />
          </div>
        </div>
      </section>

      <article className="min-h-[480px] rounded-md border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60">
        <div className="grid gap-4">
          {Array.from({ length: 10 }, (_, index) => (
            <div
              key={index}
              className="h-4 animate-pulse rounded-md bg-slate-100"
              style={{ width: `${index % 3 === 0 ? 92 : index % 3 === 1 ? 76 : 62}%` }}
            />
          ))}
        </div>
      </article>

      <aside className="space-y-5">
        {Array.from({ length: 3 }, (_, index) => (
          <section
            key={index}
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
          >
            <div className="h-5 w-28 animate-pulse rounded-md bg-slate-200" />
            <div className="mt-4 grid gap-2">
              <div className="h-4 animate-pulse rounded-md bg-slate-100" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-slate-100" />
            </div>
          </section>
        ))}
      </aside>
    </main>
  );
}
