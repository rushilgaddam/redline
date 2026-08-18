export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function InboxCardSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-ink-700 bg-ink-900/50 p-4">
      <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-3.5 w-56" />
        <Skeleton className="h-3 w-32" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function DrawingCardSkeleton() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-4">
      <div className="flex w-full items-center justify-between">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-3.5 w-14" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
