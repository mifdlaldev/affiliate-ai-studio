import { type ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react/dist/lib/types";

interface EmptyStateProps {
  /** Phosphor icon (regular or duotone) to render in the hero square. */
  icon: Icon;
  title: string;
  description: string;
  /** Optional CTA or secondary action rendered below the copy. */
  action?: ReactNode;
}

/**
 * Reusable empty state for product lists, project grids, etc. Follows the
 * dashboard's slate background palette so it slots in on `bg-slate-50` and
 * on `bg-white` cards alike.
 */
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
        <IconComponent size={32} weight="duotone" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-lg font-bold text-slate-800">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-slate-500">{description}</p>
      {action}
    </div>
  );
}
