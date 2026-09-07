import { Card, CardContent, CardHeader } from "@keiri/ui/components/card";
import { Skeleton } from "@keiri/ui/components/skeleton";

export function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="size-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-[120px] mb-1" />
        <Skeleton className="h-3 w-[80px]" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <Skeleton className="h-5 w-[150px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}

export function TransactionTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="gap-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder, list does not reorder
        <div key={i} className="flex items-center gap-x-4 px-4 py-3 border-b last:border-0">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-4 w-[40px]" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between mb-4">
        <div className="gap-y-2">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
        <Skeleton className="h-10 w-[150px]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7 mt-4">
        <div className="lg:col-span-4">
          <ChartSkeleton />
        </div>
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-5 w-[150px]" />
              <Skeleton className="h-4 w-[60px]" />
            </CardHeader>
            <CardContent className="p-0">
              <TransactionTableSkeleton />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
