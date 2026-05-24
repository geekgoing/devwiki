import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type AuthPageLoadingProps = {
  fieldCount: number;
  showCheckbox?: boolean;
  titleWidth?: string;
};

export function AuthPageLoading({
  fieldCount,
  showCheckbox = false,
  titleWidth = "w-52",
}: AuthPageLoadingProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="space-y-5">
        <Card className="p-2">
          <CardHeader>
            <Skeleton className="mb-3 size-11 rounded-lg" />
            <Skeleton className={`h-8 ${titleWidth} max-w-full`} />
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: fieldCount }, (_, index) => (
                <div key={index} className="grid gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ))}

              {showCheckbox ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-[4px]" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ) : null}

              <Skeleton className="h-11 w-full rounded-lg" />
            </div>

            <Skeleton className="mx-auto mt-4 h-4 w-36" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
