import {
  Package,
  Sparkle,
  ChatCircleDots,
  UsersThree,
  FilmSlate,
  Broadcast,
  Storefront,
  ShareNetwork,
  Globe,
  FolderOpen,
  Folders,
  VideoCamera,
  ImageSquare,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react/dist/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

/**
 * Dashboard navigation order. These map 1:1 to the feature modules the
 * product ships. Routes don't exist yet — they're stubs for upcoming
 * tasks. The sidebar and mobile drawer both render from this list.
 */
export const navItems: readonly NavItem[] = [
  { href: "/produk", label: "Product Studio", icon: Package },
  { href: "/generasikan/hook", label: "Hook Generator", icon: Sparkle },
  { href: "/generasikan/caption", label: "Caption Generator", icon: ChatCircleDots },
  { href: "/generasikan/script", label: "Script Generator", icon: VideoCamera },
  { href: "/generasikan/photo", label: "Photo Prompt", icon: ImageSquare },
  { href: "/ugc", label: "UGC Generator", icon: UsersThree },
  { href: "/storyboard", label: "Storyboard", icon: FilmSlate },
  { href: "/live-host", label: "Live Host", icon: Broadcast },
  { href: "/marketplace", label: "Marketplace", icon: Storefront },
  { href: "/social", label: "Social Media", icon: ShareNetwork },
  { href: "/landing", label: "Landing Page", icon: Globe },
  { href: "/assets", label: "Asset Library", icon: FolderOpen },
  { href: "/projects", label: "Projects", icon: Folders },
] as const;
