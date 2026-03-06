import { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface NotificationPromptProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPrompt({ open, onClose }: NotificationPromptProps) {
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
        <h2 className="text-lg font-bold text-foreground mb-2">Stay in the loop 🔔</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Get notified when someone joins your pot, requests a withdrawal, or mentions you in chat.
        </p>
        <div className="space-y-2">
          <Button onClick={handleAllow} disabled={loading} className="w-full h-11 rounded-xl">
            {loading ? 'Requesting…' : 'Allow notifications'}
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full h-11 rounded-xl text-muted-foreground">
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
