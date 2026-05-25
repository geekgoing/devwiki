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
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
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

        <section className="grid gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="p-0">
              <CardContent className="grid gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-11 rounded-lg" />
                    <div className="grid gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, itemIndex) => (
                    <Skeleton key={itemIndex} className="h-14 rounded-lg" />
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Skeleton className="h-7 w-16 rounded-lg" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
