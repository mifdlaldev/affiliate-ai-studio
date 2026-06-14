import Link from "next/link";
import {
  Sparkle,
  Target,
  Lightning,
  ChartLine,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";

interface Stat {
  icon: typeof Sparkle;
  title: string;
  description: string;
  color: string;
  bg: string;
}

const stats: readonly Stat[] = [
  {
    icon: Sparkle,
    title: "Mulai dengan Product Studio",
    description: "Upload produk pertama untuk mulai generate konten",
    color: "text-indigo-600",
    bg: "bg-indigo-600/10",
  },
  {
    icon: Target,
    title: "50 AI Generate / bulan",
    description: "Soft limit gratis, reset setiap awal bulan",
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Lightning,
    title: "Bahasa Indonesia",
    description: "AI prompts dioptimasi untuk market Indonesia",
    color: "text-amber-600",
    bg: "bg-amber-500/10",
  },
  {
    icon: ChartLine,
    title: "Export Multi-Format",
    description: "PDF, DOCX, TXT, JSON, CSV siap download",
    color: "text-sky-600",
    bg: "bg-sky-500/10",
  },
];

export default function DashboardHome() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Selamat datang di AffiliateAI Studio. Mulai dari Product Studio
          untuk mengisi library produk Anda.
        </p>
      </header>

      <section
        aria-labelledby="overview-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="overview-heading" className="sr-only">
          Ringkasan fitur
        </h2>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="p-6 transition-shadow hover:shadow-md"
            >
              <div
                className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}
              >
                <Icon
                  size={28}
                  weight="duotone"
                  aria-hidden="true"
                  className={stat.color}
                />
              </div>
              <h3 className="mb-1 text-sm font-bold text-slate-800">
                {stat.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                {stat.description}
              </p>
            </Card>
          );
        })}
      </section>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-slate-800">
          Mulai dengan Product Studio
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-500">
          Upload foto produk Anda, AI akan menganalisis dan mengisi detail
          secara otomatis. Setelah itu, Anda bisa generate berbagai konten
          marketing dari produk yang sama.
        </p>
        <Link
          href="/produk"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.97]"
        >
          Buka Product Studio
          <ArrowRight size={16} weight="bold" aria-hidden="true" />
        </Link>
      </Card>
    </div>
  );
}
