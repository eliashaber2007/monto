import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, ChevronRight, Droplets, CircleDot, PieChart, Fuel, Plane } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, usePots } from '@/hooks/usePots';
import CreatePotModal from '@/components/CreatePotModal';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Liquid Bubble SVG visual (default pot style)
function LiquidBubble({ balance, goal }: { balance: number; goal?: number | null }) {
  const pct = goal && goal > 0 ? Math.min(balance / goal, 1) : 0;
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
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(214,32%,91%)" strokeWidth={5} />
        {/* Fill arc */}
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
        {/* Center blob */}
        <circle cx={cx} cy={cy} r={14} fill="hsl(221,83%,96%)" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill="hsl(221,83%,45%)">
          {Math.round(pct * 100)}%
        </text>
      </svg>
    </div>
  );
}

function VisualIcon({ style }: { style: string }) {
  switch (style) {
    case 'progress_ring': return <CircleDot size={20} className="text-primary" />;
    case 'cake_slice': return <PieChart size={20} className="text-primary" />;
    case 'fuel_tank': return <Fuel size={20} className="text-primary" />;
    case 'flight_progress': return <Plane size={20} className="text-primary" />;
    default: return null;
  }
}

export default function MyPots() {
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: pots, isLoading } = usePots();
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: 'hsl(220,20%,97%)' }}>
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          {/* Avatar + title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-pill">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>
            <span className="font-bold text-foreground text-base">My Pots</span>
          </div>
          {/* Right icons */}
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
              <Bell size={18} />
            </button>
            <button
              onClick={signOut}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-7 pb-24">
        {/* Welcome heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {profile?.first_name ?? '…'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here are your savings pots</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !pots || pots.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-10 text-center shadow-card">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <Droplets size={28} className="text-primary" />
            </div>
            <h2 className="font-semibold text-foreground mb-1">No pots yet</h2>
            <p className="text-sm text-muted-foreground">Tap the + button to create your first savings pot.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pots.map((pot) => (
              <button
                key={pot.id}
                onClick={() => navigate(`/pots/${pot.id}`)}
                className="w-full bg-card rounded-2xl border border-border shadow-card hover:shadow-card-hover p-4 flex items-center gap-4 text-left transition-all duration-150 active:scale-[0.99] group"
              >
                {/* Liquid bubble visual */}
                <LiquidBubble balance={pot.balance ?? 0} goal={pot.goal_amount} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-foreground truncate text-[15px]">{pot.name}</span>
                    <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-accent text-primary font-semibold border border-primary/20">
                      {pot.role === 'creator' ? 'Creator' : 'Member'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pot.memberCount} {pot.memberCount === 1 ? 'member' : 'members'}
                  </div>
                  <div className="text-primary font-bold text-base mt-1">
                    {formatCurrency(pot.balance ?? 0, pot.currency ?? 'EUR')}
                  </div>
                </div>

                {/* Visual style icon */}
                {pot.visual_style && pot.visual_style !== 'liquid_bubble' && (
                  <VisualIcon style={pot.visual_style} />
                )}

                {/* Arrow */}
                <ChevronRight size={18} className="text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating + button */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary shadow-modal flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-all duration-150 active:scale-95 text-2xl font-light"
        aria-label="Create pot"
        style={{ boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}
      >
        +
      </button>

      <CreatePotModal open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
