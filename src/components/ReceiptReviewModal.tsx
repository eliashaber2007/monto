import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receipt: any;
  potId: string;
  onReviewed: () => void;
}

export default function ReceiptReviewModal({ open, onOpenChange, receipt, potId, onReviewed }: Props) {
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  const deadline = receipt?.deadline ? new Date(receipt.deadline) : null;
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000)) : null;

  const handleReview = async (action: 'approve' | 'reject') => {
    setLoading(action);
    const { error } = await supabase
      .from('receipts')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewer_comment: comment || null,
      })
      .eq('id', receipt.id);

    setLoading(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: action === 'approve' ? 'Receipt approved ✓' : 'Receipt rejected', description: action === 'approve' ? 'The member has been notified.' : 'The member can re-upload.' });
    onReviewed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle>Review Receipt</DialogTitle>
          </DialogHeader>

          {/* Deadline info */}
          {daysLeft !== null && (
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${daysLeft > 0 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
              <Clock size={12} />
              {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining to review` : 'Review deadline passed'}
            </div>
          )}

          {/* Image */}
          {receipt?.image_url ? (
            <div className="rounded-xl overflow-hidden border border-border">
              <img src={receipt.image_url} alt="Submitted receipt" className="w-full object-contain max-h-72" />
            </div>
          ) : (
            <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
              No image available
            </div>
          )}

          {/* Comment */}
          <div className="space-y-1.5">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea
              id="comment"
              placeholder="Add a note for the member…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="resize-none rounded-xl"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={() => handleReview('reject')}
              disabled={!!loading}
            >
              {loading === 'reject' ? 'Rejecting…' : (
                <><XCircle size={15} className="mr-1.5" />Reject</>
              )}
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => handleReview('approve')}
              disabled={!!loading}
            >
              {loading === 'approve' ? 'Approving…' : (
                <><CheckCircle2 size={15} className="mr-1.5" />Approve</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
