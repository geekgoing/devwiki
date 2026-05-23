export function PageLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <div className="h-8 w-40 animate-pulse rounded-md bg-slate-200" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-md bg-slate-200" />
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50">
          <div className="h-11 animate-pulse rounded-md bg-slate-100" />
        </section>

        <section className="grid gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <article
              key={index}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid flex-1 gap-3">
                  <div className="h-5 w-48 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-4 w-full max-w-2xl animate-pulse rounded-md bg-slate-100" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 animate-pulse rounded-md bg-slate-100" />
                    <div className="h-6 w-20 animate-pulse rounded-md bg-slate-100" />
                  </div>
                </div>
                <div className="h-7 w-20 animate-pulse rounded-md bg-slate-100" />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
