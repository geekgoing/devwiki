import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfilePageLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        <section className="grid gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="mt-5 grid gap-3">
                <div className="grid gap-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
                <Skeleton className="h-10 w-20 rounded-lg" />
                <Skeleton className="h-10 w-40 rounded-lg" />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border bg-muted/35 px-3 py-3">
                <div className="grid gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-10 w-20 rounded-lg" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <dl className="grid gap-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="grid gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <Skeleton className="h-6 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-16 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>

          {Array.from({ length: 2 }, (_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-28" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {Array.from({ length: 3 }, (_, rowIndex) => (
                    <Skeleton key={rowIndex} className="h-12 rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
