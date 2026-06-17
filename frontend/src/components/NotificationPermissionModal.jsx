import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Wallet, Shield } from 'lucide-react';

export default function NotificationPermissionModal({ isOpen, onComplete }) {
  const [isLoading, setIsLoading] = useState(false);

  const markDismissed = () => {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + 30);
    localStorage.setItem(
      'photoo_notification_dismissed',
      dismissUntil.toISOString()
    );
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('[Notifications] Permission:', permission);
    } catch (err) {
      console.error('[Notifications] Permission request failed:', err);
    } finally {
      markDismissed();
      setIsLoading(false);
      onComplete();
    }
  };

  const handleDismiss = () => {
    markDismissed();
    onComplete();
  };

  useEffect(() => {
    if (!isOpen) return; // Timer only runs when modal is open

    const timer = setTimeout(() => {
      console.log('[NotificationPermissionModal] Auto-dismissing after 30 seconds');
      handleDismiss();
    }, 30000); // 30 seconds

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, [isOpen, handleDismiss]);

  const benefits = [
    {
      icon: Bell,
      title: 'Gig Notifications',
      desc: 'New matching gigs, bid updates, job confirmations',
    },
    {
      icon: MessageSquare,
      title: 'Crew Communication',
      desc: 'Messages from crew members, connection requests',
    },
    {
      icon: Wallet,
      title: 'Payment & Wallet',
      desc: 'Transaction confirmations, subscription reminders',
    },
    {
      icon: Shield,
      title: 'Admin Updates',
      desc: 'Verification status, profile review feedback',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDismiss();
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Stay Connected</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Enable notifications to stay updated on what matters most to you.
          </p>

          <div className="space-y-3">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon
                      size={20}
                      className="text-orange-500"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900 font-display">
                      {benefit.title}
                    </p>
                    <p className="text-xs text-slate-600">{benefit.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            data-testid="notification-dismiss-button"
            variant="outline"
            onClick={handleDismiss}
            disabled={isLoading}
            className="rounded-full"
          >
            Not Now
          </Button>
          <Button
            data-testid="notification-enable-button"
            onClick={handleEnable}
            disabled={isLoading}
            className="rounded-full font-semibold text-white"
            style={{ background: '#E05D26' }}
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
