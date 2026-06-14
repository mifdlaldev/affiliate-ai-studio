"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingModal } from "./onboarding-modal";

interface OnboardingWrapperProps {
  showOnboarding: boolean;
}

/**
 * Client-side bridge between the server-rendered layout (which reads
 * `user_profiles.onboarding_completed`) and the modal UI.
 *
 * Flow:
 *  1. Layout computes `showOnboarding` from the latest profile row.
 *  2. Wrapper derives `open` from that prop, layered with a local
 *     `dismissed` flag so the X button can close the modal without
 *     completing onboarding. (The modal re-appears on next reload,
 *     which is intentional — onboarding is a soft gate, not a hard one.)
 *  3. After the user picks an option, the modal calls `onComplete`,
 *     which triggers `router.refresh()` so the layout re-queries the
 *     profile and re-renders with `showOnboarding = false`, closing
 *     the modal automatically.
 *
 * We deliberately avoid `useEffect` to sync prop into state: deriving
 * `open` during render keeps the SSR/CSR boundary clean and dodges the
 * `react-hooks/set-state-in-effect` rule.
 */
export function OnboardingWrapper({ showOnboarding }: OnboardingWrapperProps) {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  const open = showOnboarding && !dismissed;

  const handleClose = () => {
    setDismissed(true);
  };

  const handleComplete = () => {
    // Refresh the server component so the layout re-queries the
    // updated `onboarding_completed` flag and stops passing
    // `showOnboarding = true` down to this wrapper.
    router.refresh();
  };

  return (
    <OnboardingModal
      open={open}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
}
