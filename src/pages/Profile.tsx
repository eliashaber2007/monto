import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Eye, EyeOff, Landmark, CheckCircle2, Moon, Sun, BookOpen, RefreshCw, Globe } from 'lucide-react';

import StripeOnboardingForm from '@/components/StripeOnboardingForm';
import AvatarCustomization from '@/components/AvatarCustomization';
import UserAvatar from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/usePots';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { useTranslation } from 'react-i18next';


const LANGUAGES = [
  { code: 'en', emoji: '🇬🇧', label: 'EN', fullName: 'English' },
  { code: 'fr', emoji: '🇫🇷', label: 'FR', fullName: 'Français' },
  { code: 'de', emoji: '🇩🇪', label: 'DE', fullName: 'Deutsch' },
  { code: 'es', emoji: '🇪🇸', label: 'ES', fullName: 'Español' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
}

function DarkModeToggle() {
  const { darkMode, setDarkMode } = useDarkMode();
  const { t } = useTranslation();
  const lightMode = !darkMode;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {lightMode ? <Sun size={18} className="text-muted-foreground" /> : <Moon size={18} className="text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground">{t('profile.lightMode')}</span>
      </div>
      <button
        role="switch"
        aria-checked={lightMode}
        onClick={() => setDarkMode(!darkMode)}
        className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          lightMode ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-[27px] w-[27px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
            lightMode ? 'translate-x-[22px]' : 'translate-x-[2px]'
          } mt-[2px]`}
        />
      </button>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();

  // Personal info
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [gender, setGender] = useState<string | null>(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState('#3b82f6');
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
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

  // Stripe Connect
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChangeBankForm, setShowChangeBankForm] = useState(false);

  const [connectingBank, setConnectingBank] = useState(false);
  const stripeOnboardingComplete = (profile as any)?.stripe_onboarding_complete ?? false;

  // Handle connect query params
  useEffect(() => {
    const connectStatus = searchParams.get('connect');
    if (connectStatus === 'success') {
      toast({ title: t('profile.bankConnectedSuccess') });
      const poll = async (attempts = 0) => {
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
        if (attempts < 3) {
          setTimeout(() => poll(attempts + 1), 2000);
        }
      };
      poll();
      setSearchParams({}, { replace: true });
    } else if (connectStatus === 'refresh') {
      setSearchParams({}, { replace: true });
      handleConnectBank();
    }
  }, [searchParams]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.first_name ?? '');
      setAvatarUrl((profile as any).avatar_url ?? null);
      setAvatarColor((profile as any).avatar_color ?? '#3b82f6');
      setAvatarEmoji((profile as any).avatar_emoji ?? null);
      setGender((profile as any).gender ?? null);
    }
    if (user) {
      setEmail(user.email ?? '');
    }
  }, [profile, user]);

  // Fetch stats fresh on every mount
  useEffect(() => {
    if (!user) return;
    // Total deposited: completed transactions
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .then(({ data }) => {
        const total = (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
        setTotalDeposits(total);
      });
    // Total withdrawn: approved withdrawals only
    supabase
      .from('withdrawals')
      .select('amount')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .then(({ data }) => {
        const total = (data ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
        setTotalWithdrawals(total);
      });
  }, [user]);

  const handleConnectBank = async () => {
    setConnectingBank(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to start onboarding');
      window.location.href = result.url;
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      setConnectingBank(false);
    }
  };

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
      toast({ title: t('profile.uploadFailed'), description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = publicUrl.publicUrl + '?t=' + Date.now();

    await supabase.from('profiles').update({ avatar_url: url } as any).eq('id', user.id);
    setAvatarUrl(url);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    toast({ title: t('profile.avatarUpdated') });
    setUploadingAvatar(false);
  };

  const handleColorChange = async (color: string) => {
    if (!user) return;
    setAvatarColor(color);
    setAvatarEmoji(null);
    await supabase.from('profiles').update({ avatar_color: color, avatar_emoji: null } as any).eq('id', user.id);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const handleEmojiChange = async (emoji: string) => {
    if (!user) return;
    setAvatarEmoji(emoji);
    await supabase.from('profiles').update({ avatar_emoji: emoji } as any).eq('id', user.id);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const handleSaveInfo = async () => {
    if (!user) return;
    setSavingInfo(true);
    const { error: updateError } = await supabase.from('profiles').update({ first_name: displayName, gender } as any).eq('id', user.id);
    if (updateError) {
      toast({ title: t('profile.saveFailed'), description: updateError.message, variant: 'destructive' });
      setSavingInfo(false);
      return;
    }
    if (email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        toast({ title: t('profile.emailUpdateFailed'), description: error.message, variant: 'destructive' });
        setSavingInfo(false);
        return;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    toast({ title: t('profile.profileUpdated') });
    setSavingInfo(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: t('profile.passwordsDontMatch'), variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: t('profile.passwordMinChars'), variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: t('profile.passwordUpdateFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('profile.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initial = displayName?.[0]?.toUpperCase() ?? user?.email?.split('@')[0]?.[0]?.toUpperCase() ?? 'U';

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
          <h1 className="font-bold text-foreground text-lg">{t('profile.title')}</h1>
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

          {!avatarUrl && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">{t('profile.avatarColor')}</p>
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

        {/* Appearance */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-foreground text-base">{t('profile.appearance')}</h2>
          <DarkModeToggle />
        </div>


        {/* Payout Account */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-foreground text-base">{t('profile.payoutAccount')}</h2>
          {stripeOnboardingComplete ? (
            showChangeBankForm ? (
              <StripeOnboardingForm
                mode="update"
                onComplete={() => {
                  setShowChangeBankForm(false);
                  queryClient.invalidateQueries({ queryKey: ['profile'] });
                  queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
                }}
                onCancel={() => setShowChangeBankForm(false)}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 text-success font-semibold">
                  <CheckCircle2 size={18} />
                  {t('profile.bankConnected')}
                </div>
                <Button
                  onClick={() => setShowChangeBankForm(true)}
                  variant="outline"
                  className="w-full h-11 rounded-xl font-semibold"
                >
                  <RefreshCw size={15} className="mr-1.5" />
                  {t('profile.changeBankAccount')}
                </Button>
              </>
            )
          ) : showOnboarding ? (
            <StripeOnboardingForm
              onComplete={() => {
                setShowOnboarding(false);
                queryClient.invalidateQueries({ queryKey: ['profile'] });
                queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
              }}
              onCancel={() => setShowOnboarding(false)}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('profile.connectBankDesc')}
              </p>
              <Button
                onClick={() => setShowOnboarding(true)}
                className="w-full h-11 rounded-xl font-semibold"
              >
                <Landmark size={15} className="mr-1.5" />
                {t('profile.connectBank')}
              </Button>
            </>
          )}
        </div>

        {/* Personal Info */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-foreground text-base">{t('profile.personalInfo')}</h2>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">{t('profile.displayName')}</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">{t('profile.email')}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('profile.gender')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'male', label: t('profile.male') },
                { value: 'female', label: t('profile.female') },
                { value: 'other', label: t('profile.other') },
                { value: 'prefer_not_to_say', label: t('profile.preferNotToSay') },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(gender === opt.value ? null : opt.value)}
                  className={`py-1 px-3 text-xs font-medium rounded-full border transition-colors ${
                    gender === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleSaveInfo} disabled={savingInfo} className="w-full h-11 rounded-xl font-semibold">
            <Save size={15} className="mr-1.5" />
            {savingInfo ? t('profile.saving') : t('profile.saveChanges')}
          </Button>
        </div>

        {/* Change Password */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground text-base">{t('profile.changePassword')}</h2>
            <button onClick={() => setShowPasswords(!showPasswords)} className="text-muted-foreground">
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw" className="text-sm">{t('profile.newPassword')}</Label>
            <Input id="new-pw" type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('profile.enterNewPassword')} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw" className="text-sm">{t('profile.confirmNewPassword')}</Label>
            <Input id="confirm-pw" type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('profile.confirmNewPasswordPlaceholder')} className="rounded-xl" />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword || !confirmPassword} className="w-full h-11 rounded-xl font-semibold">
            {savingPassword ? t('auth.updating') : t('profile.updatePassword')}
          </Button>
        </div>

        {/* Language */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-foreground text-base">{t('profile.language')}</h2>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 transition-all text-sm font-medium ${
                  i18n.language === lang.code
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <span aria-hidden="true">{lang.emoji}</span>
                <span>{lang.fullName}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          <button
            onClick={() => navigate('/onboarding?tutorial=true')}
            className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors rounded-t-2xl"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{t('profile.howMontoWorks')}</span>
            </div>
            <span className="text-muted-foreground text-xs">→</span>
          </button>
          <button
            onClick={() => navigate('/faq')}
            className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors rounded-b-2xl"
          >
            <span className="text-sm font-semibold text-foreground pl-[30px]">{t('profile.faq')}</span>
            <span className="text-muted-foreground text-xs">→</span>
          </button>
        </div>

        {/* Stats */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-foreground text-base mb-4">{t('profile.yourStats')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-success/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-success">{formatCurrency(totalDeposits)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('profile.totalDeposited')}</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalWithdrawals)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('profile.totalWithdrawn')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
