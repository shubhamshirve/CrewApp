import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstallAppButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installedMode, setInstalledMode] = useState(false);

  useEffect(() => {
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstalledMode(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      // Reset the deferred prompt variable
      setDeferredPrompt(null);

      // Hide the button after the user has responded
      if (outcome === 'accepted') {
        setCanInstall(false);
      }
    } catch (error) {
      console.error('[InstallAppButton] Install prompt error:', error);
      setDeferredPrompt(null);
    }
  };

  // Only render if the install prompt is available and not already installed
  if (!canInstall || installedMode) {
    return null;
  }

  return (
    <Button
      onClick={handleInstallClick}
      className="w-full mt-4 font-semibold font-display rounded-full"
      data-testid="install-app-button"
      type="button"
    >
      <Download size={16} className="mr-2" />
      Install App
    </Button>
  );
}
