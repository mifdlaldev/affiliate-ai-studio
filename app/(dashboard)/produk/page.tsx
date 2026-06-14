"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { ProductUploader } from "@/components/shared/product-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeProduct, saveProduct, type ProductAnalysis } from "@/lib/actions/product";

/**
 * Product Studio — the entry point for affiliate content generation.
 *
 * Three-column layout on `lg+`:
 *   1. Upload + reference link form (calls Auto-Analyze)
 *   2. Live image preview
 *   3. Editable form filled by the AI (Task 11) and persisted in Task 12
 *
 * Auto-Analyze calls the `analyzeProduct` server action, which:
 *   - Enforces the 50/month usage limit
 *   - Calls BLIP-2 for image captioning (if image provided)
 *   - Calls DeepSeek V4 Flash to extract structured product details
 *   - Persists the result to `product_analyses`
 */
export default function ProductStudioPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [referenceLink, setReferenceLink] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);

  const handleAutoAnalyze = async () => {
    if (!imageUrl && !referenceLink) {
      toast.error("Upload foto atau masukkan link terlebih dahulu");
      return;
    }
    setIsAnalyzing(true);
    setAnalysis(null);
    const result = await analyzeProduct(imageUrl ?? "", referenceLink);
    setIsAnalyzing(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data) {
      setAnalysis(result.data);
      toast.success("Auto-analisis selesai!");
    }
  };

  const handleFieldChange = (field: keyof ProductAnalysis, value: string) => {
    if (!analysis) return;
    setAnalysis({ ...analysis, [field]: value });
  };

  const handleReset = () => {
    setImageUrl(null);
    setReferenceLink("");
    setAnalysis(null);
  };

  const handleSave = async () => {
    if (!analysis) {
      toast.error("Belum ada data untuk disimpan");
      return;
    }
    setIsSaving(true);
    const result = await saveProduct({
      name: analysis.name,
      category: analysis.category,
      brand: analysis.brand,
      price: analysis.price,
      target_market: analysis.target_market,
      usp: analysis.usp,
      benefits: analysis.benefits,
      image_url: imageUrl,
      reference_link: referenceLink || null,
    });
    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.success) {
      toast.success("Produk berhasil disimpan!");
      handleReset();
    }
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
            className="mb-4 flex items-center text-base font-bold text-slate-800"
          >
            <Sparkle
              size={20}
              weight="duotone"
              className="mr-2 text-indigo-600"
              aria-hidden="true"
            />
            3. Detail Informasi
          </h3>

          {analysis ? (
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label htmlFor="product-name" className="text-slate-700">
                  Nama Produk
                </Label>
                <Input
                  id="product-name"
                  value={analysis.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  className="h-10 border-slate-300 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="product-category" className="text-slate-700">
                    Kategori
                  </Label>
                  <Input
                    id="product-category"
                    value={analysis.category}
                    onChange={(e) =>
                      handleFieldChange("category", e.target.value)
                    }
                    className="h-10 border-slate-300 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-brand" className="text-slate-700">
                    Brand
                  </Label>
                  <Input
                    id="product-brand"
                    value={analysis.brand}
                    onChange={(e) =>
                      handleFieldChange("brand", e.target.value)
                    }
                    className="h-10 border-slate-300 bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-price" className="text-slate-700">
                  Harga
                </Label>
                <Input
                  id="product-price"
                  value={analysis.price}
                  onChange={(e) => handleFieldChange("price", e.target.value)}
                  className="h-10 border-slate-300 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-target" className="text-slate-700">
                  Target Pasar
                </Label>
                <Input
                  id="product-target"
                  value={analysis.target_market}
                  onChange={(e) =>
                    handleFieldChange("target_market", e.target.value)
                  }
                  className="h-10 border-slate-300 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-usp" className="text-slate-700">
                  USP
                </Label>
                <Textarea
                  id="product-usp"
                  rows={2}
                  value={analysis.usp}
                  onChange={(e) => handleFieldChange("usp", e.target.value)}
                  className="border-slate-300 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-benefits" className="text-slate-700">
                  Benefits
                </Label>
                <Textarea
                  id="product-benefits"
                  rows={3}
                  value={analysis.benefits}
                  onChange={(e) =>
                    handleFieldChange("benefits", e.target.value)
                  }
                  className="border-slate-300 bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Sparkle
                size={48}
                weight="duotone"
                className="mb-2 text-slate-300"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500">
                {isAnalyzing
                  ? "Menganalisis produk..."
                  : "Upload foto dan klik 'Jalankan Auto-Analisis' untuk mengisi form secara otomatis."}
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-3 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={!imageUrl && !referenceLink && !analysis}
              className="h-10 flex-1 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!analysis || isSaving}
              className="h-10 flex-1"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
