import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-24" />
        </section>

        <Card>
          <CardContent className="p-3">
            <Skeleton className="h-11" />
          </CardContent>
        </Card>

        <section className="grid gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid flex-1 gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full max-w-2xl" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
