import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentLoading() {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <Card className="lg:col-span-2">
        <CardContent className="px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="grid flex-1 gap-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-10 w-80 max-w-full" />
              <Skeleton className="h-5 w-full max-w-2xl" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      <article className="min-h-[480px] rounded-xl bg-card p-8 ring-1 ring-foreground/10">
        <div className="grid gap-4">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-4"
              style={{
                width: `${index % 3 === 0 ? 92 : index % 3 === 1 ? 76 : 62}%`,
              }}
            />
          ))}
        </div>
      </article>

      <aside className="space-y-5">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-28" />
              <div className="mt-4 grid gap-2">
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </aside>
    </main>
  );
}
