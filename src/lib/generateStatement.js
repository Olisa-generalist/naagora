// src/lib/generateStatement.js
// ─────────────────────────────────────────────
// Generates and downloads a professional account statement
// as an HTML file that prints cleanly as a PDF.
//
// Contains all information needed for reconciliation:
// - Account holder details
// - Opening and closing balance for the period
// - Itemized credits (order payouts) with order reference,
//   product name, quantity, listed price, 5% Naagora fee,
//   and net amount received
// - Itemized debits (withdrawals) with bank details
// - Running balance column
// - Summary totals at the bottom
// ─────────────────────────────────────────────

export function generateStatement({ profile, wallet, transactions, periodLabel }) {
  const now = new Date()
  const generatedAt = now.toLocaleString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  // Calculate opening balance by working backwards from current balance
  // (current balance + total withdrawals - total credits = opening balance at start of all time)
  // For a period statement, we just show all transactions and opening = 0 at account creation
  const totalCredits = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
  const totalDebits = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0)
  const closingBalance = Number(wallet?.balance || 0)
  const openingBalance = closingBalance - totalCredits + totalDebits

  // Build running balance for each transaction row
  let runningBalance = openingBalance
  const rows = [...transactions].reverse().map(t => {
    const credit = t.type === 'credit' ? Number(t.amount) : 0
    const debit = t.type === 'debit' ? Number(t.amount) : 0
    runningBalance = runningBalance + credit - debit
    return { ...t, credit, debit, balance: runningBalance }
  }).reverse()

  function naira(n) {
    return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const roleLabel = profile?.role === 'farmer' ? 'Farmer' : 'Logistics Provider'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Naagora Account Statement — ${profile?.full_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a18; background: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #0F6E56; padding-bottom: 20px; }
  .brand { font-size: 24px; font-weight: 700; color: #0F6E56; }
  .brand-sub { font-size: 11px; color: #5F5E5A; margin-top: 2px; }
  .statement-title { text-align: right; }
  .statement-title h2 { font-size: 16px; font-weight: 700; color: #1a1a18; }
  .statement-title p { font-size: 11px; color: #5F5E5A; margin-top: 3px; }

  /* Account info grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; background: #F7F6F2; border-radius: 8px; padding: 16px 20px; }
  .info-block dt { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .info-block dd { font-size: 12px; font-weight: 500; }

  /* Summary boxes */
  .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .summary-box { border: 0.5px solid #E5E3DA; border-radius: 8px; padding: 12px 14px; }
  .summary-box .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .summary-box .value { font-size: 15px; font-weight: 700; }
  .summary-box.green .value { color: #0F6E56; }
  .summary-box.red .value { color: #A32D2D; }

  /* Table */
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #5F5E5A; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead tr { background: #0F6E56; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.3px; white-space: nowrap; }
  thead th.right { text-align: right; }
  tbody tr { border-bottom: 0.5px solid #F0EEE8; }
  tbody tr:nth-child(even) { background: #FAFAF8; }
  tbody tr:hover { background: #F7F6F2; }
  td { padding: 8px 10px; font-size: 11px; vertical-align: top; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  td.credit { color: #0F6E56; font-weight: 600; text-align: right; }
  td.debit { color: #A32D2D; font-weight: 600; text-align: right; }
  td.balance { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  td.ref { font-size: 10px; color: #888; font-family: monospace; }
  .badge-credit { background: #E1F5EE; color: #085041; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .badge-debit { background: #FCEBEB; color: #791F1F; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; }

  /* Fee breakdown sub-row */
  .fee-detail { font-size: 10px; color: #888; margin-top: 2px; }

  /* Totals footer row */
  .totals-row td { font-weight: 700; font-size: 12px; background: #F7F6F2; border-top: 1.5px solid #0F6E56; }

  /* Footer */
  .footer { border-top: 0.5px solid #E5E3DA; padding-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
  .footer strong { color: #1a1a18; }

  /* Disclaimer */
  .disclaimer { background: #FAEEDA; border-left: 3px solid #BA7517; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 20px; font-size: 10px; color: #633806; line-height: 1.6; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
    button { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Print / Download button — hidden when printing -->
  <div style="text-align:right; margin-bottom:20px; print-display:none">
    <button onclick="window.print()"
      style="background:#0F6E56;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">Naagora</div>
      <div class="brand-sub">Agricultural Marketplace · naagora.vercel.app</div>
    </div>
    <div class="statement-title">
      <h2>Account Statement</h2>
      <p>Generated: ${generatedAt}</p>
      <p>Period: ${periodLabel}</p>
    </div>
  </div>

  <!-- Account information -->
  <div class="info-grid">
    <div class="info-block">
      <dt>Account holder</dt>
      <dd>${profile?.full_name || '—'}</dd>
    </div>
    <div class="info-block">
      <dt>Account type</dt>
      <dd>${roleLabel}</dd>
    </div>
    <div class="info-block">
      <dt>Email address</dt>
      <dd>${profile?.email || '—'}</dd>
    </div>
    <div class="info-block">
      <dt>Platform</dt>
      <dd>Naagora Agricultural Marketplace</dd>
    </div>
  </div>

  <!-- Summary boxes -->
  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Opening balance</div>
      <div class="value">${naira(openingBalance)}</div>
    </div>
    <div class="summary-box green">
      <div class="label">Total credited</div>
      <div class="value">${naira(totalCredits)}</div>
    </div>
    <div class="summary-box red">
      <div class="label">Total withdrawn</div>
      <div class="value">${naira(totalDebits)}</div>
    </div>
    <div class="summary-box green">
      <div class="label">Closing balance</div>
      <div class="value">${naira(closingBalance)}</div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="disclaimer">
    <strong>Note on Naagora fees:</strong> All credit amounts shown reflect the 95% payout you receive after Naagora's 5% service fee deduction. The "Listed price" column shows the original order value before the fee. This is consistent with Naagora's three-party fee model where each participant (buyer, farmer, and logistics provider) contributes a 5% platform fee per transaction.
  </div>

  <!-- Transaction table -->
  <div class="section-title">Transaction details</div>

  ${rows.length === 0 ? '<p style="color:#888;font-size:12px;margin-bottom:20px;">No transactions in this period.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Reference</th>
        <th>Description</th>
        <th>Type</th>
        <th class="right">Listed price</th>
        <th class="right">Naagora fee (5%)</th>
        <th class="right">Credit (₦)</th>
        <th class="right">Debit (₦)</th>
        <th class="right">Balance (₦)</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(t => {
        const listedPrice = t.type === 'credit' ? (Number(t.amount) / 0.95) : null
        const naagFee = listedPrice ? (listedPrice - Number(t.amount)) : null
        const shortRef = t.orderId ? `NAG-${t.orderId.substring(0, 8).toUpperCase()}` : (t.id ? t.id.substring(0, 8).toUpperCase() : '—')
        return `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td class="ref">${shortRef}</td>
        <td>
          <strong>${t.label}</strong>
          ${t.type === 'credit' && listedPrice ? `<div class="fee-detail">Listed: ${naira(listedPrice)} − 5% fee = ${naira(t.amount)}</div>` : ''}
          ${t.bankDetails ? `<div class="fee-detail">${t.bankDetails}</div>` : ''}
          ${t.status && t.status !== 'success' ? `<div class="fee-detail" style="color:#BA7517">Status: ${t.status}</div>` : ''}
        </td>
        <td><span class="${t.type === 'credit' ? 'badge-credit' : 'badge-debit'}">${t.type === 'credit' ? 'CREDIT' : 'DEBIT'}</span></td>
        <td class="right" style="color:#888">${t.type === 'credit' && listedPrice ? naira(listedPrice) : '—'}</td>
        <td class="right" style="color:#888">${naagFee ? naira(naagFee) : '—'}</td>
        <td class="credit">${t.type === 'credit' ? naira(t.amount) : '—'}</td>
        <td class="debit">${t.type === 'debit' ? naira(t.amount) : '—'}</td>
        <td class="balance">${naira(t.balance)}</td>
      </tr>`
      }).join('')}
      <!-- Totals row -->
      <tr class="totals-row">
        <td colspan="4"><strong>TOTALS</strong></td>
        <td class="right">—</td>
        <td class="right">—</td>
        <td class="credit">${naira(totalCredits)}</td>
        <td class="debit">${naira(totalDebits)}</td>
        <td class="balance">${naira(closingBalance)}</td>
      </tr>
    </tbody>
  </table>
  `}

  <!-- Footer -->
  <div class="footer">
    <div>
      <strong>Naagora Agricultural Marketplace</strong><br>
      naagora.vercel.app · support@naagora.com<br>
      This statement is generated automatically from your Naagora wallet records.
    </div>
    <div style="text-align:right">
      <strong>Document reference</strong><br>
      ${profile?.id?.substring(0, 12)?.toUpperCase() || 'N/A'}<br>
      Page 1 of 1
    </div>
  </div>

</div>
</body>
</html>`

  // Open in new tab — user can Print → Save as PDF from there
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    // Fallback: download as .html file if popup blocked
    const a = document.createElement('a')
    a.href = url
    a.download = `Naagora_Statement_${profile?.full_name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
