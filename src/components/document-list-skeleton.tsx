import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="grid gap-4" aria-label="문서 목록 로딩 중">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid flex-1 gap-3">
                <Skeleton className="h-5 w-52 max-w-full" />
                <Skeleton className="h-4 w-full max-w-2xl" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-14" />
                </div>
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
