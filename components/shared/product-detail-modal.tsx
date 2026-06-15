"use client";

import { Package } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/types";

export type ProductWithDetails = Database["public"]["Tables"]["products"]["Row"];

interface ProductDetailModalProps {
  product: ProductWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Render `—` for null / empty / whitespace-only strings so the user
 * never sees a stray "null" or a blank row label.
 */
function formatValue(value: string | null | undefined): string {
  if (!value || !value.trim()) return "—";
  return value;
}

/**
 * Indonesian long date format, e.g. "12 Juni 2026".
 */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
    new Date(iso),
  );
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
}: ProductDetailModalProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 overflow-hidden">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package
                  size={28}
                  weight="duotone"
                  className="text-slate-400"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">{product.name}</DialogTitle>
              <DialogDescription>
                {[product.brand, product.category].filter(Boolean).join(" · ")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Detail Informasi
          </h3>
          <DefinitionRow label="Kategori" value={formatValue(product.category)} />
          <DefinitionRow label="Brand" value={formatValue(product.brand)} />
          <DefinitionRow label="Harga" value={formatValue(product.price)} />
          <DefinitionRow
            label="Target Pasar"
            value={formatValue(product.target_market)}
          />
          <DefinitionRow label="USP" value={formatValue(product.usp)} />
          <DefinitionRow
            label="Benefits"
            value={formatValue(product.benefits)}
            multiline
          />
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>Disimpan: {formatDate(product.created_at)}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DefinitionRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`col-span-2 text-sm text-slate-800 ${
          multiline ? "whitespace-pre-line" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
