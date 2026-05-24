import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PasswordPageLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6">
        <section className="grid gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-full max-w-md" />
        </section>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="grid gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
              ))}
              <Skeleton className="h-11 w-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
