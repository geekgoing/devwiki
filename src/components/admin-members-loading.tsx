import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminMembersLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-8 w-36" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="size-10 rounded-lg" />
        </section>

        <Card className="border-dashed shadow-none">
          <CardContent className="px-4 py-3">
            <Skeleton className="h-4 w-full max-w-lg" />
          </CardContent>
        </Card>

        <Card className="p-0">
          <div className="hidden border-b bg-muted/45 px-4 py-2 lg:grid lg:grid-cols-[minmax(220px,1.2fr)_minmax(150px,0.8fr)_130px_110px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_90px]">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-16" />
            ))}
          </div>

          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="grid gap-3 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.2fr)_minmax(150px,0.8fr)_130px_110px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_90px]"
            >
              <div className="grid gap-2">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-20" />
              <div className="grid gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-10 w-16 rounded-lg" />
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
