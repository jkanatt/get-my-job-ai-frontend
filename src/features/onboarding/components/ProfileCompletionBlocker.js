'use client';

import React, { useState } from 'react';
import { useProfile } from '@/shared/hooks';
import OnboardingPopup from '@/features/onboarding/components/OnboardingPopup';

/**
 * A wrapper component that intercepts children's actions if the profile is incomplete.
 * Pass a render prop or children that receive the `executeWithBlocker` function.
 */
export default function ProfileCompletionBlocker({ children }) {
  const { isComplete } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const executeWithBlocker = (e, action) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    if (!isComplete) {
      setPendingAction(() => action);
      setIsOpen(true);
    } else {
      action();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPendingAction(null);
  };

  const handleComplete = () => {
    setIsOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return (
    <>
      {typeof children === 'function' ? children({ executeWithBlocker }) : children}
      {isOpen && (
        <OnboardingPopup 
          isOpen={isOpen} 
          onClose={handleClose} 
          onComplete={handleComplete} 
          isBlockerMode={true} 
        />
      )}
    </>
  );
}
