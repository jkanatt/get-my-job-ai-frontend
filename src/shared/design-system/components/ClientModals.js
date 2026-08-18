'use client';

import dynamic from 'next/dynamic';

const ComposeModal = dynamic(() => import('@/features/communications/components/ComposeModal'), { ssr: false });
const CommandPalette = dynamic(() => import('@/shared/design-system/components/CommandPalette'), { ssr: false });
const OnboardingPopup = dynamic(() => import('@/features/onboarding/components/OnboardingPopup'), { ssr: false });

/**
 * Client-side wrapper for dynamically loaded modals/overlays.
 * These use `ssr: false` which requires a Client Component boundary.
 */
export default function ClientModals() {
  return (
    <>
      <ComposeModal />
      <CommandPalette />
      <OnboardingPopup />
    </>
  );
}
