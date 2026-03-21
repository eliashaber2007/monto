import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Member {
  user_id: string;
  role: string;
  profiles?: { first_name?: string; avatar_color?: string };
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
  status: string;
}

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  total_deducted?: number;
  created_at: string;
  status: string;
  note?: string;
}

interface Expense {
  withdrawal_id: string;
  name: string;
  amount: number;
}

interface Pot {
  name: string;
  created_at: string;
  balance: number;
  goal_amount?: number | null;
  currency: string;
}

export function generatePotReport(
  pot: Pot,
  members: Member[],
  transactions: Transaction[],
  withdrawals: Withdrawal[],
  expenses: Expense[],
) {
  const doc = new jsPDF();
  const currency = pot.currency || 'EUR';
  const fmt = (n: number) => {
    const formatted = new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
    // Ensure space between currency sign and number (e.g. "€12" → "€ 12")
    return formatted.replace(/^([^\d\s-]+)(\d)/, '$1 $2').replace(/^([^\d\s-]+)(-)/, '$1 $2');
  };
  const dateStr = (s: string) =>
    new Date(s).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });

  const primaryColor: [number, number, number] = [37, 99, 235];
  const darkText: [number, number, number] = [30, 41, 59];
  const mutedText: [number, number, number] = [100, 116, 139];

  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Monto', 14, y);
  doc.setFontSize(10);
  doc.setTextColor(...mutedText);
  doc.setFont('helvetica', 'normal');
  doc.text('Pot Activity Report', 55, y);
  y += 4;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 12;

  // Pot Summary
  doc.setFontSize(14);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Pot Summary', 14, y);
  y += 8;

  const completedDeposits = transactions.filter(t => Number(t.amount) > 0 && t.status === 'completed');
  const totalAdded = completedDeposits.reduce((s, t) => s + Number(t.amount), 0);
  const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved');
  const totalWithdrawn = approvedWithdrawals.reduce((s, w) => s + Number(w.total_deducted || w.amount), 0);

  const summaryData = [
    ['Pot Name', pot.name],
    ['Created', dateStr(pot.created_at)],
    ['Goal Amount', pot.goal_amount ? fmt(pot.goal_amount) : 'No goal set'],
    ['Current Balance', fmt(pot.balance)],
    ['Total Funds Added', fmt(totalAdded)],
    ['Total Withdrawn', fmt(totalWithdrawn)],
    ['Members', String(members.length)],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3, textColor: darkText },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // Member Breakdown
  doc.setFontSize(14);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Member Breakdown', 14, y);
  y += 2;

  const getName = (userId: string) => {
    const m = members.find(m => m.user_id === userId);
    return (m?.profiles as any)?.first_name || 'Unknown';
  };

  const memberRows = members.map(m => {
    const uid = m.user_id;
    const name = (m.profiles as any)?.first_name || 'Unknown';
    const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
    const memberDeposits = completedDeposits.filter(t => t.user_id === uid);
    const totalDeposited = memberDeposits.reduce((s, t) => s + Number(t.amount), 0);
    const memberApproved = approvedWithdrawals.filter(w => w.user_id === uid);
    const totalMemberWithdrawn = memberApproved.reduce((s, w) => s + Number(w.total_deducted || w.amount), 0);
    return [name, role, fmt(totalDeposited), String(memberApproved.length), fmt(totalMemberWithdrawn)];
  });

  autoTable(doc, {
    startY: y,
    head: [['Name', 'Role', 'Total Added', 'Withdrawals', 'Total Withdrawn']],
    body: memberRows,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3, textColor: darkText },
    margin: { left: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // Withdrawal History
  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFontSize(14);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text('Withdrawal History', 14, y);
  y += 2;

  const expensesByWithdrawal: Record<string, Expense[]> = {};
  expenses.forEach(e => {
    if (!expensesByWithdrawal[e.withdrawal_id]) expensesByWithdrawal[e.withdrawal_id] = [];
    expensesByWithdrawal[e.withdrawal_id].push(e);
  });

  const withdrawalRows = approvedWithdrawals.map(w => {
    const name = getName(w.user_id);
    const date = dateStr(w.created_at);
    const deducted = Number(w.total_deducted || w.amount);
    const received = Number(w.amount);
    const wExpenses = expensesByWithdrawal[w.id] || [];
    const expenseList = wExpenses.map(e => `${e.name}: ${fmt(e.amount)}`).join(', ') || '—';
    const expenseTotal = wExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const justified = deducted > 0 ? Math.min(100, Math.round((expenseTotal / deducted) * 100)) : 0;
    return [name, date, fmt(deducted), fmt(received), expenseList, `${justified}%`];
  });

  if (withdrawalRows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...mutedText);
    doc.setFont('helvetica', 'normal');
    doc.text('No approved withdrawals yet.', 14, y + 8);
    y += 16;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Member', 'Date', 'Deducted', 'Received', 'Expenses', 'Justified']],
      body: withdrawalRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: darkText, overflow: 'linebreak' },
      columnStyles: { 4: { cellWidth: 50 } },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text(
      `Generated by Monto on ${new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      14,
      290,
    );
    doc.text(`Page ${i} of ${pageCount}`, 180, 290);
  }

  const safeName = pot.name.replace(/[^a-zA-Z0-9]/g, '_');
  const today = new Date().toISOString().slice(0, 10);
  doc.save(`Monto_Report_${safeName}_${today}.pdf`);
}
