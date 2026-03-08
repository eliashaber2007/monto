import { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NotificationPromptProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPrompt({ open, onClose }: NotificationPromptProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    setLoading(true);
    try {
      await Notification.requestPermission();
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
