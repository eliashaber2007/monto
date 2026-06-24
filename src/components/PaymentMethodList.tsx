import { memo, useMemo } from 'react';
import { CreditCard, Building2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type PaymentMethod = 'card' | 'revolut_pay' | 'sepa';

export function calcFee(amount: number, method: PaymentMethod) {
  if (method === 'sepa') return parseFloat(((amount * 0.005) + 0.35).toFixed(2));
  if (method === 'revolut_pay') return parseFloat(((amount * 0.012) + 0.15).toFixed(2));
  return parseFloat(((amount * 0.02) + 0.25).toFixed(2));
}

interface PaymentMethodListProps {
  amount: number;
  currency: string;
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  showSepa: boolean;
}

interface RowProps {
  method: PaymentMethod;
  icon: React.ReactNode;
  name: string;
  speedLabel: string;
  speedTone: 'fast' | 'slow';
  amount: number;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}

const Row = memo(function Row({ method, icon, name, speedLabel, speedTone, amount, currency, selected, onSelect }: RowProps) {
  const { t } = useTranslation();
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v);
  const fee = useMemo(() => calcFee(amount, method), [amount, method]);
  const total = useMemo(() => parseFloat((amount + fee).toFixed(2)), [amount, fee]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 rounded-xl p-3.5 text-left border-2 transition-colors ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border/40 bg-transparent hover:border-border'
      }`}
    >
      {/* Radio indicator — constant size, only color changes */}
      <span className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
        selected ? 'border-primary' : 'border-muted-foreground/40'
      }`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </span>

      {/* Icon + name + fee breakdown */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-foreground">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{name}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {t('addFunds.addedToPot', { amount: fmt(amount) })}
        </div>
        <div className="text-sm font-semibold text-foreground">
          {t('addFunds.totalCharged', { total: fmt(total) })}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {t('paymentMethods.feeLabel', { fee: fmt(fee), defaultValue: 'Fee: {{fee}}' })}
        </div>
      </div>

      {/* Speed pill */}
      <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        speedTone === 'fast'
          ? 'bg-success/15 text-success'
          : 'bg-muted text-muted-foreground'
      }`}>
        {speedLabel}
      </span>
    </button>
  );
});

export default function PaymentMethodList({
  amount,
  currency,
  selected,
  onSelect,
  showSepa,
}: PaymentMethodListProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Row
        method="card"
        icon={<CreditCard className="h-4 w-4" />}
        name={t('addFunds.card')}
        speedLabel={t('paymentMethods.instant', { defaultValue: 'Instant' })}
        speedTone="fast"
        amount={amount}
        currency={currency}
        selected={selected === 'card'}
        onSelect={() => onSelect('card')}
      />
      <Row
        method="revolut_pay"
        icon={<Wallet className="h-4 w-4" />}
        name={t('addFunds.revolut')}
        speedLabel={t('paymentMethods.instant', { defaultValue: 'Instant' })}
        speedTone="fast"
        amount={amount}
        currency={currency}
        selected={selected === 'revolut_pay'}
        onSelect={() => onSelect('revolut_pay')}
      />
      {showSepa && (
        <Row
          method="sepa"
          icon={<Building2 className="h-4 w-4" />}
          name={t('addFunds.sepa')}
          speedLabel={t('paymentMethods.twoToThreeDays', { defaultValue: '2–3 days' })}
          speedTone="slow"
          amount={amount}
          currency={currency}
          selected={selected === 'sepa'}
          onSelect={() => onSelect('sepa')}
        />
      )}
    </div>
  );
}
