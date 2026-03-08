import { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VAPID_PUBLIC_KEY } from '@/lib/constants';

interface NotificationPromptProps {
  open: boolean;
  onClose: () => void;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationPrompt({ open, onClose }: NotificationPromptProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAllow = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted' && user) {
        // Register service worker and subscribe to push
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;

          const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (vapidPublicKey) {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
            });

            const subJson = subscription.toJSON();
            
            // Store subscription in database
            await supabase.from('push_subscriptions').upsert({
              user_id: user.id,
              endpoint: subJson.endpoint!,
              p256dh: subJson.keys!.p256dh!,
              auth: subJson.keys!.auth!,
            } as any, { onConflict: 'user_id,endpoint' });
          }
        } catch (swErr) {
          console.error('Push subscription error:', swErr);
        }
      }
    } catch {
      // Browser may not support notifications
    }
    setLoading(false);
    localStorage.setItem('notificationPromptShown', 'true');
    onClose();
  };

  const handleDismiss = () => {
    localStorage.setItem('notificationPromptShown', 'true');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-xs rounded-2xl text-center p-6 gap-0 [&>button]:hidden">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bell className="text-primary" size={28} />
          </div>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">{t('notifications.stayInLoop')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {t('notifications.notificationDesc')}
        </p>
        <div className="space-y-2">
          <Button onClick={handleAllow} disabled={loading} className="w-full h-11 rounded-xl">
            {loading ? t('notifications.requesting') : t('notifications.allowNotifications')}
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full h-11 rounded-xl text-muted-foreground">
            {t('notifications.notNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
