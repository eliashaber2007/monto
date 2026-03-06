import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Droplets, Sparkles, LogOut, Archive } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, usePots } from '@/hooks/usePots';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import CreatePotModal from '@/components/CreatePotModal';
import OnboardingModal from '@/components/OnboardingModal';
import NotificationBell from '@/components/NotificationBell';
import NotificationPrompt from '@/components/NotificationPrompt';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function LiquidBubble({ balance, peakBalance }: { balance: number; peakBalance: number }) {
  const effectivePeak = peakBalance > 0 ? peakBalance : balance;
  const pct = effectivePeak > 0 ? Math.min(balance / effectivePeak, 1) : 0;
  const r = 22;
  const cx = 28;
  const cy = 28;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg width={56} height={56} viewBox="0 0 56 56">
        <defs>
          <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(221,83%,68%)" />
            <stop offset="100%" stopColor="hsl(221,83%,45%)" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(214,32%,91%)" strokeWidth={5} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="url(#bubbleGrad)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <circle cx={cx} cy={cy} r={14} fill="hsl(221,83%,96%)" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill="hsl(221,83%,45%)">
          {Math.round(pct * 100)}%
        </text>
      </svg>
    </div>
  );
}

function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return `Good morning, ${name}! ☀️`;
  if (hour >= 12 && hour < 18) return `Good afternoon, ${name}! 👋`;
  if (hour >= 18) return `Good evening, ${name}! 🌙`;
  return `Good night, ${name}! 🌙`;
}

export default function MyPots() {
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pots, isLoading } = usePots();
  const [showCreate, setShowCreate] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Handle cancelled pot creation redirect
  useEffect(() => {
    if (searchParams.get('pot_cancelled') === 'true') {
      localStorage.removeItem('pendingPotData');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || '';

  const hasSeenOnboarding = (profile as any)?.has_seen_onboarding ?? true;

  // Show onboarding for users who haven't seen it yet
  const onboardingTriggered = useRef(false);
  useEffect(() => {
    if (profile && !hasSeenOnboarding && !onboardingTriggered.current) {
      onboardingTriggered.current = true;
      setShowOnboarding(true);
    }
  }, [profile, hasSeenOnboarding]);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (user?.id) {
      await supabase.from('profiles').update({ has_seen_onboarding: true } as any).eq('id', user.id);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
    // Show notification prompt if not already shown and permission is default
    const alreadyShown = localStorage.getItem('notificationPromptShown') === 'true';
    const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default';
    if (!alreadyShown && canAsk) {
      setShowNotificationPrompt(true);
    }
  };

  // Filter out closed pots, then sort: creators first, then by recency
  const activePots = (pots ?? [])
    .filter((p: any) => p.status !== 'closed')
    .sort((a: any, b: any) => {
      const aCreator = a.role === 'creator' ? 0 : 1;
      const bCreator = b.role === 'creator' ? 0 : 1;
      if (aCreator !== bCreator) return aCreator - bCreator;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated onboarding background */}
      {showOnboarding && (
        <div className="fixed inset-0 z-10 pointer-events-none">
          <div className="onboarding-orb onboarding-orb-1" />
          <div className="onboarding-orb onboarding-orb-2" />
          <div className="onboarding-orb onboarding-orb-3" />
        </div>
      )}
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile')}
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm overflow-hidden"
                style={{ backgroundColor: (profile as any)?.avatar_url ? undefined : ((profile as any)?.avatar_color ?? 'hsl(var(--primary))') }}
              >
                {(profile as any)?.avatar_url ? (
                  <img src={(profile as any).avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {displayName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </button>
              <span className="font-bold text-foreground text-lg">My Pots 🏦</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => navigate('/archive')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
              aria-label="Pot archive"
            >
              <Archive size={18} />
            </button>
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

       <div className="max-w-lg mx-auto px-5 pt-8 pb-28">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          {getGreeting(displayName)}
        </h1>
        {activePots.length > 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            💰 You've got {activePots.length} active {activePots.length === 1 ? 'pot' : 'pots'}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activePots.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <h2 className="font-bold text-foreground text-lg mb-2">No pots yet!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Create your first pot with your friends. It only takes a minute! ✨
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Sparkles size={16} />
              Create my first pot
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activePots.map((pot: any) => (
              <button
                key={pot.id}
                onClick={() => navigate(`/pots/${pot.id}`)}
                className="w-full bg-card rounded-2xl border border-border shadow-sm hover:shadow-md p-5 flex items-center gap-4 text-left transition-all duration-200 active:scale-[0.99] group"
              >
                <LiquidBubble balance={pot.balance ?? 0} peakBalance={pot.peak_balance ?? 0} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {pot.emoji && <span className="text-lg flex-shrink-0">{pot.emoji}</span>}
                    <span className="font-bold text-foreground truncate text-lg">{pot.name}</span>
                    <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary font-semibold border border-primary/20">
                      {pot.role === 'creator' ? '👑 Creator' : '👤 Member'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {pot.memberCount} {pot.memberCount === 1 ? 'member' : 'members'} 🤝
                  </div>
                  <div className="text-primary font-bold text-base">
                    {formatCurrency(pot.balance ?? 0, pot.currency ?? 'EUR')}
                  </div>
                </div>

                <ChevronRight size={18} className="text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* Trust footer */}
        <div className="mt-10 mb-4 flex flex-col items-center gap-1.5 text-muted-foreground/60">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Secured by</span>
            <svg viewBox="0 0 60 25" className="h-[14px] w-auto" fill="currentColor"><path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95l.6 3.54c-1.37.78-3.2 1.27-5.1 1.27-4.7 0-7.27-2.98-7.27-7.37 0-4.14 2.45-7.55 6.83-7.55 4.14 0 6.17 3.03 6.17 6.98 0 .58-.06 1.23-.12 1.53h-.3zm-4.32-5.89c-.06 0-2.68-.06-2.68 2.62h5.36c0-1.78-.86-2.62-2.68-2.62zM40.84 18.5h-4.58V6.33l-4.3.94-.72-3.82 5.9-1.78h3.7V18.5zm-12.46-4.04c0 3.9-2.37 4.7-5.47 4.7-1.54 0-3.34-.37-4.76-1.03l.72-3.72c1.11.58 2.68.95 3.66.95.86 0 1.36-.25 1.36-.95 0-1.78-5.78-.95-5.78-5.53 0-3.48 2.37-4.7 5.28-4.7 1.48 0 3.03.31 4.14.78l-.66 3.6c-.86-.43-2.37-.72-3.28-.72-.86 0-1.24.25-1.24.83 0 1.78 6.03.89 6.03 5.79zm-14.66 4.04h-4.7l-.12-1.54c-.98 1.17-2.44 1.84-4.14 1.84-2.31 0-3.97-1.6-3.97-4.2 0-3.78 3.16-5.16 7.49-5.16v-.37c0-1.05-.62-1.54-2.19-1.54-1.42 0-3.03.43-4.27 1.05L1.6 5.63c1.42-.72 3.72-1.3 5.96-1.3 4.45 0 6.17 1.97 6.17 5.78v8.39h-.01zm-4.7-5.96c-2.25 0-3.28.62-3.28 1.84 0 .86.55 1.36 1.48 1.36 1.05 0 1.97-.74 1.97-2.06v-1.14h-.17z"/></svg>
          </div>
          <span className="text-[10px]">Your money and data are protected</span>
        </div>
      </div>

      {/* Floating + button */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-all duration-150 active:scale-95 text-2xl font-light"
        aria-label="Create pot"
        style={{ boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}
      >
        +
      </button>

      <CreatePotModal open={showCreate} onOpenChange={setShowCreate} />
      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      <NotificationPrompt open={showNotificationPrompt} onClose={() => setShowNotificationPrompt(false)} />
    </div>
  );
}
