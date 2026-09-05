import { Card } from '../../_ui/primitives';
import { SkeletonRows } from '../../_ui/skeleton';

/**
 * Ожидание списка объектов.
 *
 * Повторяет раскладку настоящих строк, чтобы при появлении данных ничего
 * не прыгнуло. Заголовок и фильтры не рисуются: они приходят мгновенно
 * и мелькали бы серым зря.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <SkeletonRows />
      </Card>
    </div>
  );
}
