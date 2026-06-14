"use client";

import { useState } from "react";
import { Package } from "@phosphor-icons/react/dist/ssr";
import { ProductUploader } from "@/components/shared/product-uploader";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Product Studio — the entry point for affiliate content generation.
 * Layout is three columns on `lg+`: upload form (left), live preview
 * (center), and detail form placeholder (right). The detail form is
 * a stand-in until Tasks 11–12 wire the AI auto-fill and the editable
 * form. The handler here is a deliberate no-op: it just simulates a
 * 1.5s request so the button's loading state can be verified end-to-end.
 */
export default function ProductStudioPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [referenceLink, setReferenceLink] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAutoAnalyze = async () => {
    setIsAnalyzing(true);
    // Placeholder for Task 11 — replaced with real analyzeProduct action.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsAnalyzing(false);
  };

  const handleReset = () => {
    setImageUrl(null);
    setReferenceLink("");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Product Studio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload dan analisis produk untuk mulai membuat materi pemasaran.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <ProductUploader
          imageUrl={imageUrl}
          onImageChange={setImageUrl}
          referenceLink={referenceLink}
          onReferenceLinkChange={setReferenceLink}
          onAutoAnalyze={handleAutoAnalyze}
          isAnalyzing={isAnalyzing}
        />

        <section
          aria-labelledby="preview-heading"
          className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3
            id="preview-heading"
            className="mb-4 flex items-center text-base font-bold text-slate-800"
          >
            <Package
              size={20}
              weight="duotone"
              className="mr-2 text-indigo-600"
              aria-hidden="true"
            />
            2. Preview Produk
          </h3>
          <div className="flex aspect-square w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Pratinjau produk"
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <div className="p-6 text-center">
                <Package
                  size={48}
                  weight="duotone"
                  className="mx-auto mb-2 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-slate-400">
                  Belum ada foto yang diupload
                </p>
              </div>
            )}
          </div>
        </section>

        <section
          aria-labelledby="details-heading"
          className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3
            id="details-heading"
            className="mb-4 text-base font-bold text-slate-800"
          >
            3. Detail Informasi
          </h3>
          <div className="flex-1">
            <EmptyState
              icon={Package}
              title="Belum ada analisis"
              description={
                "Upload foto dan klik 'Jalankan Auto-Analisis' untuk mengisi form secara otomatis."
              }
            />
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={!imageUrl && !referenceLink}
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </section>
      </div>
    </div>
  );
}
