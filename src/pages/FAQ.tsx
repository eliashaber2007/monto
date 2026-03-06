import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS = [
  {
    q: "Where does my money go when I add funds?",
    a: "When you add money to a pot, it is held securely by Stripe — a global payments platform trusted by millions of businesses. Your funds are protected and only accessible through Monto.",
  },
  {
    q: "How do withdrawals work?",
    a: "The pot creator can withdraw funds at any time. Depending on the pot settings, members can also request withdrawals which the creator approves or rejects. Once approved, the money is sent directly to the creator's connected bank account, usually within 1–5 business days.",
  },
  {
    q: "Are there any fees?",
    a: "Monto charges no fees for adding money to a pot. Standard Stripe processing fees may apply on transactions. Withdrawals to your bank account are free.",
  },
  {
    q: "Is my money safe?",
    a: "Yes. All payments are processed by Stripe, which is PCI DSS compliant and uses bank-level encryption. Monto never stores your card or bank details directly.",
  },
  {
    q: "How do I connect my bank account?",
    a: 'Go to your Profile page and tap "Payout Account". Follow the steps to enter your details and connect your bank account via our secure onboarding form. You must connect a bank account before you can receive withdrawals.',
  },
  {
    q: "Can I leave a pot?",
    a: "Yes, you can leave any pot you are a member of at any time. If you are the creator, you can close the pot entirely, which will trigger a final withdrawal of remaining funds.",
  },
  {
    q: "Who can invite people to a pot?",
    a: "Both the pot creator and members can share the invite link to bring new people into a pot.",
  },
  {
    q: "What happens if a withdrawal is rejected?",
    a: "If the creator rejects a withdrawal request, no money is moved and the requester receives a notification letting them know.",
  },
];

export default function FAQ() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-foreground text-lg">FAQ</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6">
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card rounded-xl border border-border px-4 data-[state=open]:shadow-sm transition-shadow"
            >
              <AccordionTrigger className="text-sm font-semibold text-foreground text-left py-4 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
