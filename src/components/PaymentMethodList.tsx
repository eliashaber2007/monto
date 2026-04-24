import { CreditCard, Building2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type PaymentMethod = 'card' | 'revolut_pay' | 'sepa';

export function calcFee(amount: number, method: PaymentMethod) {
  if (method === 'sepa') {
    return parseFloat(((amount * 0.005) + 0.35).toFixed(2));
  }
  if (method === 'revolut_pay') {
    return parseFloat(((amount * 0.012) + 0.15).toFixed(2));
  }
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

function Row({ method, icon, name, speedLabel, speedTone, amount, currency, selected, onSelect }: RowProps) {
  const { t } = useTranslation();
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(v);
  const fee = calcFee(amount, method);
  const total = parseFloat((amount + fee).toFixed(2));

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 rounded-xl p-3.5 text-left transition-all"
      style={{
        border: selected
          ? '1.5px solid hsl(var(--primary))'
          : '1px solid rgba(127,127,127,0.18)',
        backgroundColor: selected ? 'rgba(29,78,216,0.08)' : 'transparent',
      }}
    >
      {/* Radio */}
      <span
        className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
        style={{
          width: 18,
          height: 18,
          border: selected ? '1.5px solid #1D4ED8' : '1.5px solid rgba(127,127,127,0.5)',
          backgroundColor: 'transparent',
        }}
      >
        {selected && (
          <span
            className="rounded-full"
            style={{ width: 10, height: 10, backgroundColor: '#1D4ED8' }}
          />
        )}
      </span>

      {/* Icon + name + amounts */}
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
      <span
        className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{
          backgroundColor:
            speedTone === 'fast' ? 'rgba(34,197,94,0.15)' : 'rgba(127,127,127,0.18)',
          color: speedTone === 'fast' ? 'rgb(34,197,94)' : 'hsl(var(--muted-foreground))',
        }}
      >
        {speedLabel}
      </span>
    </button>
  );
}

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
