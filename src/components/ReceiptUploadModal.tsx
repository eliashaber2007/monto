import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, Clock, CheckCircle2, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  potId: string;
  transactionId: string;
  windowDays: number;
  onUploaded: () => void;
}

export default function ReceiptUploadModal({ open, onOpenChange, potId, transactionId, windowDays, onUploaded }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${potId}/${transactionId}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: true });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
      const imageUrl = urlData?.publicUrl ?? path;

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + windowDays);

      const { error: insertError } = await supabase.from('receipts').insert({
        pot_id: potId,
        user_id: user.id,
        transaction_id: transactionId,
        image_url: imageUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        deadline: deadline.toISOString(),
      });

      if (insertError) throw insertError;

      toast({ title: 'Receipt submitted!', description: 'The pot creator will review it shortly.' });
      onUploaded();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const clear = () => { setFile(null); setPreview(null); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) clear(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock size={16} className="text-warning" />
              Upload receipt within {windowDays} days
            </DialogTitle>
          </DialogHeader>

          {!preview ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This pot requires a receipt for each contribution. Choose how to upload yours.
              </p>

              {/* Camera button */}
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Camera size={18} className="text-primary-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Open Camera</div>
                  <div className="text-xs text-muted-foreground">Take a photo with your device</div>
                </div>
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

              {/* Gallery button */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <ImagePlus size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Upload from gallery</div>
                  <div className="text-xs text-muted-foreground">Choose an existing image</div>
                </div>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={preview} alt="Receipt preview" className="w-full object-contain max-h-64" />
                <button
                  onClick={clear}
                  className="absolute top-2 right-2 w-7 h-7 bg-foreground/70 rounded-full flex items-center justify-center text-white hover:bg-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground text-center">Looks good? Confirm to submit.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={clear}>
                  Retake
                </Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={handleSubmit} disabled={uploading}>
                  {uploading ? 'Uploading…' : (
                    <><CheckCircle2 size={15} className="mr-1.5" />Confirm</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
