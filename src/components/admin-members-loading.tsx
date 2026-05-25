import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminMembersLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="size-10 rounded-lg" />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="p-0">
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="size-10 rounded-lg" />
                <div className="grid gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-10" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="p-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Skeleton className="h-10 w-full rounded-lg sm:max-w-sm" />
            <Skeleton className="h-4 w-16" />
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="grid min-w-[900px] grid-cols-[minmax(280px,1.6fr)_120px_180px_180px_210px] border-b bg-muted/45 px-4 py-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-24" />
                ))}
              </div>

              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="grid min-w-[900px] grid-cols-[minmax(280px,1.6fr)_120px_180px_180px_210px] items-center border-b px-4 py-4 last:border-b-0"
                >
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-7 w-16 rounded-lg" />
                    <Skeleton className="h-7 w-16 rounded-lg" />
                    <Skeleton className="h-7 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
