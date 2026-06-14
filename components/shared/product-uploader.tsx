"use client";

import { useRef, useState } from "react";
import {
  CloudArrowUp,
  Trash,
  Link as LinkIcon,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";

interface ProductUploaderProps {
  /** Data URL of the currently selected image, or `null` if no image. */
  imageUrl: string | null;
  /** Called whenever the image changes (file picked, dropped, or removed). */
  onImageChange: (url: string | null) => void;
  /** Reference product URL (Shopee / TikTok Shop / Tokopedia), optional. */
  referenceLink: string;
  onReferenceLinkChange: (link: string) => void;
  /** Trigger Auto-Analyze. Real implementation lands in Task 11. */
  onAutoAnalyze: () => void;
  /** True while the analyze request is in flight. */
  isAnalyzing: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Dropzone + reference-link form for the Product Studio. Handles local
 * preview only — the resulting data URL is held in parent state and will
 * be replaced by a Supabase Storage upload in a later task. The Auto-Analyze
 * button is wired through a parent callback so the page can show a loading
 * state while the real AI request (Task 11) runs.
 */
export function ProductUploader({
  imageUrl,
  onImageChange,
  referenceLink,
  onReferenceLinkChange,
  onAutoAnalyze,
  isAnalyzing,
}: ProductUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File terlalu besar. Maksimum 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        onImageChange(result);
      }
    };
    reader.onerror = () => {
      toast.error("Gagal membaca file.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = (
    event: React.MouseEvent | React.KeyboardEvent,
  ) => {
    event.stopPropagation();
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const canAnalyze = Boolean(imageUrl) && !isAnalyzing;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center text-base font-bold text-slate-800">
        <CloudArrowUp
          size={20}
          weight="duotone"
          className="mr-2 text-indigo-600"
          aria-hidden="true"
        />
        1. Upload Produk
      </h3>

      <div
        className={`group relative flex min-h-[280px] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[10px] border-2 border-dashed bg-slate-50 p-8 text-center transition-colors ${
          isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-200 hover:border-indigo-400"
        }`}
        onClick={openFileDialog}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFileDialog();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Upload foto produk"
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Pratinjau produk"
              className="h-full w-full object-contain p-2"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-3 top-3 rounded-full bg-red-100 p-2 text-red-600 opacity-0 shadow-sm transition-opacity hover:bg-red-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Hapus gambar"
              title="Hapus gambar"
            >
              <Trash size={16} weight="bold" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600 transition-transform group-hover:scale-110">
              <CloudArrowUp size={32} weight="duotone" aria-hidden="true" />
            </div>
            <p className="mb-1 text-sm font-medium text-slate-800">
              Klik atau Drag &amp; Drop foto di sini
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Mendukung PNG, JPG, WEBP (Maks. 5MB)
            </p>
            <span className="pointer-events-none rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
              Pilih File Komputer
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <label
          htmlFor="reference-link"
          className="mb-1.5 flex items-center text-xs font-medium text-slate-800"
        >
          <LinkIcon
            size={14}
            weight="bold"
            className="mr-1 text-slate-400"
            aria-hidden="true"
          />
          Link Referensi Produk (Opsional)
        </label>
        <input
          id="reference-link"
          type="url"
          value={referenceLink}
          onChange={(event) => onReferenceLinkChange(event.target.value)}
          placeholder="https://shopee.co.id/..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Masukkan link produk (Shopee/TikTok/Tokopedia) agar analisis AI lebih presisi.
        </p>
      </div>

      <button
        type="button"
        onClick={onAutoAnalyze}
        disabled={!canAnalyze}
        aria-busy={isAnalyzing}
        aria-disabled={!canAnalyze}
        className={`mt-4 flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
          canAnalyze
            ? "bg-indigo-600 hover:bg-indigo-700"
            : "cursor-not-allowed bg-slate-300"
        }`}
      >
        {isAnalyzing ? (
          <>
            <span
              className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
            Menganalisis...
          </>
        ) : (
          <>
            <Sparkle
              size={16}
              weight="bold"
              className="mr-2"
              aria-hidden="true"
            />
            Jalankan Auto-Analisis
          </>
        )}
      </button>
    </div>
  );
}
