import { prisma } from '@kleekto/db';

import type { AuthContext } from '../auth/context';
import { requirePermission } from '../rbac/guard';

export interface PipelineStatusSummary {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  colorToken: string | null;
}

/**
 * Статусы воронки компании.
 *
 * Инвариант 4: читаются из базы, а не из константы в коде. Компания их
 * переименовывает и переупорядочивает под себя, и логика обязана обращаться
 * к статусу по коду, а не по позиции в списке.
 */
export async function listPipelineStatuses(ctx: AuthContext): Promise<PipelineStatusSummary[]> {
  requirePermission(ctx, 'pipelineStatus', 'read');

  const statuses = await prisma.pipelineStatus.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { sortOrder: 'asc' },
  });

  return statuses.map((status) => ({
    id: status.id,
    code: status.code,
    name: status.name,
    sortOrder: status.sortOrder,
    isSystem: status.isSystem,
    colorToken: status.colorToken,
  }));
}
