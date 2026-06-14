"use client";

import { useState } from "react";
import {
  Sparkle,
  X,
  ArrowRight,
  Check,
  Lightning,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/actions/onboarding";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * First-run welcome modal. Two steps:
 *   0 — pitch (what the product does + CTA "Mulai")
 *   1 — sample-data opt-in (load 2 demo products or start empty)
 *
 * The X button is intentional: onboarding is not a hard gate. If the
 * user dismisses the modal without choosing, the layout re-queries
 * `onboarding_completed` after `router.refresh()` so the modal will
 * re-appear next time they reload. We never persist "skipped" state
 * outside the user_profiles table.
 */
export function OnboardingModal({
  open,
  onClose,
  onComplete,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const finish = async (loadSampleData: boolean) => {
    setLoading(true);
    const result = await completeOnboarding(loadSampleData);
    setLoading(false);
    if (result.error) {
      // Best effort — log and still close so the user is not trapped.
      console.error(result.error);
    }
    onComplete();
    onClose();
  };

  const handleLoadSample = () => {
    void finish(true);
  };

  const handleSkip = () => {
    void finish(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Tutup"
        >
          <X size={20} />
        </button>

        {step === 0 && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
              <Sparkle size={32} weight="duotone" />
            </div>
            <h2
              id="onboarding-title"
              className="mb-2 text-2xl font-bold text-slate-800"
            >
              Selamat Datang
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              AffiliateAI Studio membantu Anda membuat konten marketing 10x
              lebih cepat dengan AI. Mari kita mulai.
            </p>
            <div className="mb-6 space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Sparkle size={16} weight="duotone" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    AI-Powered Generators
                  </p>
                  <p className="text-xs text-slate-500">
                    Hooks, scripts, captions, dan lainnya
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Lightning size={16} weight="duotone" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    50 Generate/bulan
                  </p>
                  <p className="text-xs text-slate-500">Soft limit gratis</p>
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setStep(1)}
              className="w-full"
              size="lg"
            >
              Mulai
              <ArrowRight size={16} weight="bold" className="ml-2" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
              <Sparkle size={24} weight="duotone" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-800">
              Coba dengan Data Contoh?
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              Kami akan menambahkan 2 produk contoh (Skintific Mugwort, Sepatu
              Lari XYZ) agar Anda bisa langsung mencoba fitur AI.
            </p>
            <div className="mb-6 rounded-lg bg-slate-50 p-4">
              <p className="text-xs leading-relaxed text-slate-600">
                Anda bisa menghapus data contoh kapan saja dari Product Studio.
                Atau tambahkan produk Anda sendiri.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleLoadSample}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Memuat...
                  </>
                ) : (
                  <>
                    <Check size={16} weight="bold" className="mr-2" />
                    Ya, Tambahkan Data Contoh
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Mulai dari Kosong
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
