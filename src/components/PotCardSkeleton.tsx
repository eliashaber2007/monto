import { Skeleton } from '@/components/ui/skeleton';

export default function PotCardSkeleton() {
  return (
    <div className="w-full bg-card rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4">
      <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
    </div>
  );
}
