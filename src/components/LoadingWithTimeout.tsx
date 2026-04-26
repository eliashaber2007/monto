import { useLoadingTimeout } from '@/hooks/useLoadingTimeout';
import { useTranslation } from 'react-i18next';

interface Props {
  onRetry?: () => void;
  timeoutMs?: number;
  className?: string;
}

/**
 * Spinner that swaps to a retry button after `timeoutMs` (default 5s).
 * If no onRetry is provided, defaults to a full page reload.
 */
export default function LoadingWithTimeout({ onRetry, timeoutMs = 5000, className }: Props) {
  const { t } = useTranslation();
  const timedOut = useLoadingTimeout(true, timeoutMs);

  const handleRetry = () => {
    if (onRetry) onRetry();
    else window.location.reload();
  };

  if (timedOut) {
    return (
      <div className={className ?? 'min-h-[40vh] flex flex-col items-center justify-center gap-3 p-6 text-center'}>
        <p className="text-sm text-muted-foreground">
          {t('common.loadingTimeout', 'This is taking longer than expected.')}
        </p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={className ?? 'min-h-[40vh] flex items-center justify-center'}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
