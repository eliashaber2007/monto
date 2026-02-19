import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/usePots';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#6366f1', '#a855f7', '#64748b',
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // Personal info
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState('#3b82f6');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Stats
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.first_name ?? '');
      setAvatarUrl((profile as any).avatar_url ?? null);
      setAvatarColor((profile as any).avatar_color ?? '#3b82f6');
    }
    if (user) {
      setEmail(user.email ?? '');
    }
  }, [profile, user]);

  // Fetch stats
  useEffect(() => {
    if (!user) return;
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .then(({ data }) => {
        const total = (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
        setTotalDeposits(total);
      });
    // No withdrawals table yet, keep at 0
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);

    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = publicUrl.publicUrl + '?t=' + Date.now();

    await supabase.from('profiles').update({ avatar_url: url } as any).eq('id', user.id);
    setAvatarUrl(url);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    toast({ title: 'Avatar updated! 📸' });
    setUploadingAvatar(false);
  };

  const handleColorChange = async (color: string) => {
    if (!user) return;
    setAvatarColor(color);
    await supabase.from('profiles').update({ avatar_color: color } as any).eq('id', user.id);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const handleSaveInfo = async () => {
    if (!user) return;
    setSavingInfo(true);

    // Update display name
    await supabase.from('profiles').update({ first_name: displayName }).eq('id', user.id);

    // Update email if changed
    if (email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        toast({ title: 'Email update failed', description: error.message, variant: 'destructive' });
        setSavingInfo(false);
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['profile'] });
    toast({ title: 'Profile updated! ✅' });
    setSavingInfo(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords don\'t match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Password update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password changed! 🔒' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initial = displayName?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-foreground text-lg">Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        {/* Avatar Section */}
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <div className="relative inline-block">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-border"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-border"
                style={{ backgroundColor: avatarColor }}
              >
                {initial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <p className="mt-3 font-bold text-foreground text-lg">{displayName}</p>
          <p className="text-sm text-muted-foreground">{email}</p>

          {/* Color picker (only when no photo) */}
          {!avatarUrl && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Avatar color</p>
              <div className="flex flex-wrap justify-center gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className={`w-7 h-7 rounded-full transition-all ${avatarColor === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Personal Info */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-foreground text-base">Personal Info</h2>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">Display Name</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            onClick={handleSaveInfo}
            disabled={savingInfo}
            className="w-full h-11 rounded-xl font-semibold"
          >
            <Save size={15} className="mr-1.5" />
            {savingInfo ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>

        {/* Change Password */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground text-base">Change Password</h2>
            <button onClick={() => setShowPasswords(!showPasswords)} className="text-muted-foreground">
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw" className="text-sm">New Password</Label>
            <Input
              id="new-pw"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw" className="text-sm">Confirm New Password</Label>
            <Input
              id="confirm-pw"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="rounded-xl"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="w-full h-11 rounded-xl font-semibold"
          >
            {savingPassword ? 'Updating…' : 'Update Password'}
          </Button>
        </div>

        {/* Stats */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-foreground text-base mb-4">Your Stats</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-success/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-success">{formatCurrency(totalDeposits)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Deposited</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalWithdrawals)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Withdrawn</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
