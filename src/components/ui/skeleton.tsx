import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted-foreground/15 before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1.6s_infinite] before:bg-linear-to-r before:from-transparent before:via-background/65 before:to-transparent dark:bg-foreground/15",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
