import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <Sparkle
          weight="duotone"
          size={64}
          aria-hidden="true"
          className="text-indigo-600 mx-auto mb-6"
        />

        <h1 className="text-4xl font-bold text-slate-800 tracking-tight">
          AffiliateAI Studio
        </h1>

        <p className="mt-4 text-base text-slate-500 leading-relaxed">
          Buat Konten Affiliate 10x Lebih Cepat dengan AI.
          <br />
          Dari riset produk sampai copywriting, semua dalam satu tempat.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            Mulai Sekarang
          </Link>
        </div>
      </div>
    </main>
  );
}
