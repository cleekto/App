import { Card } from '../../_ui/primitives';
import { Skeleton, SkeletonTiles } from '../../_ui/skeleton';

/** Ожидание сводки: три плитки и две колонки под ними. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonTiles />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="flex flex-col gap-3 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </Card>
      </div>
    </div>
  );
}
