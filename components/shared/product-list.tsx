"use client";

import { useEffect, useState } from "react";
import { Package, Trash } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { deleteProduct } from "@/lib/actions/product";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

interface Product {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  image_url: string | null;
  created_at: string;
}

interface ProductListProps {
  /**
   * Bump this number from the parent to force a re-fetch (e.g. after a
   * successful save or delete). The component treats it as a black-box
   * dependency so the parent can use any counter scheme.
   */
  refreshKey: number;
  /** Optional callback fired after a successful delete (parent may bump its own refreshKey). */
  onProductDeleted?: () => void;
}

/**
 * Read-only grid of products saved by the signed-in user. RLS already
 * scopes the query to the caller, so we don't need to filter by user_id
 * here — Supabase will only return rows owned by the current session.
 *
 * The grid re-fetches whenever `refreshKey` changes, which the parent
 * (Product Studio page) bumps after a save or a delete from elsewhere.
 */
export function ProductList({
  refreshKey,
  onProductDeleted,
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  async function loadProducts() {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, brand, image_url, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load products error:", error);
        toast.error("Gagal memuat daftar produk");
        setProducts([]);
      } else {
        setProducts(data ?? []);
      }
    } catch (err) {
      console.error("loadProducts unexpected error:", err);
      toast.error("Gagal memuat daftar produk");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Hapus produk "${product.name}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(product.id);
    const result = await deleteProduct(product.id);
    setDeletingId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Produk "${product.name}" dihapus`);
    loadProducts();
    onProductDeleted?.();
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500">
        <span className="inline-block w-6 h-6 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin mr-2" />
        Memuat produk...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Belum ada produk"
        description="Upload dan simpan produk pertama Anda untuk mulai menggunakan AI generators."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group"
        >
          <div className="aspect-square bg-slate-50 overflow-hidden relative">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain p-2"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Package size={48} weight="duotone" />
              </div>
            )}
          </div>
          <div className="p-3">
            <h3
              className="font-bold text-slate-800 text-sm mb-1 line-clamp-1"
              title={product.name}
            >
              {product.name}
            </h3>
            {product.brand && (
              <p className="text-xs text-slate-500 mb-1 line-clamp-1">
                {product.brand}
              </p>
            )}
            {product.category && (
              <span className="inline-block px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded-full font-medium uppercase tracking-wide mb-2">
                {product.category}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDelete(product)}
              disabled={deletingId === product.id}
              className="w-full text-xs"
            >
              {deletingId === product.id ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-1" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash size={12} weight="bold" className="mr-1" />
                  Hapus
                </>
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
