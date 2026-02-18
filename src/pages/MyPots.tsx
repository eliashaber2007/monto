import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, Bell, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, usePots } from '@/hooks/usePots';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function MyPots() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: pots, isLoading } = usePots();
  const [showCreate, setShowCreate] = useState(false);
  const [potName, setPotName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreatePot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);

    const { data: pot, error } = await supabase
      .from('pots')
      .insert({ name: potName.trim(), created_by: user.id })
      .select()
      .single();

    if (error || !pot) {
      setCreating(false);
      toast({ title: 'Error', description: error?.message ?? 'Could not create pot.', variant: 'destructive' });
      return;
    }

    // Insert creator as member
    const { error: memberError } = await supabase
      .from('pot_members')
      .insert({ pot_id: pot.id, user_id: user.id, role: 'creator' });

    setCreating(false);
    if (memberError) {
      toast({ title: 'Error', description: memberError.message, variant: 'destructive' });
      return;
    }

    setPotName('');
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ['pots'] });
    toast({ title: 'Pot created!', description: `"${pot.name}" is ready.` });
    navigate(`/pots/${pot.id}`);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Pots</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.first_name ?? '…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
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

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !pots || pots.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Plus size={28} className="text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-foreground mb-1">No pots yet</h2>
            <p className="text-sm text-muted-foreground">Create your first savings pot to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pots.map((pot) => (
              <button
                key={pot.id}
                onClick={() => navigate(`/pots/${pot.id}`)}
                className="w-full bg-card rounded-2xl shadow-card hover:shadow-card-hover border border-border p-4 flex items-center gap-4 text-left transition-all duration-150 active:scale-[0.99]"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full border-2 border-border bg-surface flex-shrink-0" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{pot.name}</span>
                    <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                      {pot.role === 'creator' ? 'Creator' : 'Member'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pot.memberCount} {pot.memberCount === 1 ? 'member' : 'members'}
                  </div>
                  <div className="text-primary font-bold mt-1">
                    {formatCurrency(pot.balance ?? 0, pot.currency ?? 'EUR')}
                  </div>
                  <div className="text-xs text-muted-foreground">0% left</div>
                </div>

                {/* Arrow */}
                <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating + button */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary shadow-modal flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95"
        aria-label="Create pot"
      >
        <Plus size={24} />
      </button>

      {/* Create Pot Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create a new pot</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePot} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="potName">Pot name</Label>
              <Input
                id="potName"
                placeholder="e.g. Holiday Fund"
                value={potName}
                onChange={(e) => setPotName(e.target.value)}
                required
                className="h-11"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={creating || !potName.trim()}>
                {creating ? 'Creating…' : 'Create pot'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
