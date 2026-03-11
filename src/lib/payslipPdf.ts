/**
 * payslipPdf.ts
 *
 * Generates a styled PDF payslip using a hidden print window.
 * No external libraries — uses the browser's native print-to-PDF.
 * Logo is embedded as a base64 data URL.
 */

import { CommissionSummary, monthName } from "./commissionService";

// ── Logo import — base64 via Vite's ?url transform ──────────────────────────
// We use a dynamic fetch to convert the logo to base64 at runtime
async function logoToBase64(): Promise<string> {
  try {
    const resp = await fetch("/logo.png");                // served from /public or /assets
    if (!resp.ok) throw new Error("logo not found");
    const blob = await resp.blob();
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch {
    // Fallback: try the assets path
    try {
      const resp = await fetch(new URL("../assets/logo.png", import.meta.url).href);
      if (!resp.ok) return "";
      const blob = await resp.blob();
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }
}

export async function generatePayslipPdf(
  summary: CommissionSummary,
  commissionPercent: number,
): Promise<void> {
  const logoSrc = await logoToBase64();
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="Oasis Logo" style="height:80px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : "";

  const period = `${monthName(summary.month)} ${summary.year}`;
  const now    = new Date().toLocaleDateString("en-NA", { day: "2-digit", month: "long", year: "numeric" });
  const rate   = summary.commission_rate ?? commissionPercent;
  const revenue    = Number(summary.total_revenue).toFixed(2);
  const commission = Number(summary.total_commission).toFixed(2);
  const paidDate   = summary.paid_at
    ? new Date(summary.paid_at).toLocaleDateString("en-NA", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const statusColor =
    summary.payout_status === "paid"     ? "#16a34a" :
    summary.payout_status === "approved" ? "#2563eb" : "#d97706";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payslip — ${summary.employee_name} — ${period}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 210mm; min-height: 297mm; font-family: 'Inter', Arial, sans-serif; background: #fff; color: #1a2d4a; }
    @page { size: A4; margin: 12mm 14mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

    .page { padding: 0; max-width: 182mm; margin: 0 auto; }

    /* Header band */
    .header-band {
      background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%);
      border-radius: 12px;
      padding: 24px 28px 20px;
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 22px;
    }
    .header-left { text-align: left; }
    .company-name {
      font-family: 'Space Grotesk', Arial, sans-serif;
      font-size: 18px; font-weight: 700; color: #fff; letter-spacing: 0.5px;
    }
    .company-sub { font-size: 10px; color: #94b4d4; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase; }
    .header-right { text-align: right; }
    .payslip-title {
      font-family: 'Space Grotesk', Arial, sans-serif;
      font-size: 22px; font-weight: 700; color: #FF8C00; letter-spacing: 1px; text-transform: uppercase;
    }
    .payslip-period { font-size: 11px; color: #94b4d4; margin-top: 3px; }

    /* Orange accent line */
    .accent-line { height: 3px; background: linear-gradient(90deg, #FF8C00, #ffb347, transparent); border-radius: 2px; margin-bottom: 22px; }

    /* Two-col info grid */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px; }
    .info-card {
      background: #f0f5fb; border-radius: 10px; padding: 14px 16px;
      border-left: 4px solid #FF8C00;
    }
    .info-card-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b8aab; margin-bottom: 6px; }
    .info-card-value { font-size: 13px; font-weight: 700; color: #1a2d4a; }
    .info-card-sub   { font-size: 11px; color: #5a7a9a; margin-top: 2px; }

    /* Earnings table */
    .section-title {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;
      color: #6b8aab; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
    }
    .section-title::after { content: ''; flex: 1; height: 1px; background: #d4e0ed; }

    .earn-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    .earn-table th {
      background: #1a2d4a; color: #fff; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.8px; padding: 9px 12px; text-align: left;
    }
    .earn-table th:last-child { text-align: right; }
    .earn-table td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e8f0f8; }
    .earn-table td:last-child { text-align: right; font-weight: 600; }
    .earn-table tr:last-child td { border-bottom: none; }
    .earn-table tr.total-row td {
      background: #f0f5fb; font-weight: 700; font-size: 13px;
      border-top: 2px solid #FF8C00;
    }

    /* Status badge */
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    }

    /* Net pay box */
    .net-pay-box {
      background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%);
      border-radius: 12px; padding: 18px 24px;
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 22px;
    }
    .net-pay-label { font-size: 12px; color: #94b4d4; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .net-pay-amount { font-family: 'Space Grotesk', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #FF8C00; }
    .net-pay-currency { font-size: 14px; color: #94b4d4; }

    /* Notes */
    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; margin-bottom: 22px; font-size: 11px; color: #78350f; }
    .notes-label { font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; font-size: 10px; }

    /* Footer */
    .payslip-footer {
      border-top: 1px solid #d4e0ed; padding-top: 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .footer-legal { font-size: 9px; color: #94b4d4; line-height: 1.6; }
    .footer-generated { font-size: 9px; color: #94b4d4; text-align: right; }

    /* Watermark for paid */
    .watermark {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 72px; font-weight: 900; color: rgba(22,163,74,0.06);
      pointer-events: none; z-index: 0; font-family: 'Space Grotesk', Arial, sans-serif;
      text-transform: uppercase; letter-spacing: 8px;
    }
  </style>
</head>
<body>
  ${summary.payout_status === "paid" ? '<div class="watermark">PAID</div>' : ""}
  <div class="page">

    <!-- Header -->
    <div class="header-band">
      <div class="header-left">
        ${logoHtml}
        <div class="company-name">Oasis Pure Cleaning CC</div>
        <div class="company-sub">Mobile Car Wash &amp; Detailing · Windhoek, Namibia</div>
      </div>
      <div class="header-right">
        <div class="payslip-title">Payslip</div>
        <div class="payslip-period">${period}</div>
      </div>
    </div>

    <div class="accent-line"></div>

    <!-- Employee + Period info -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-title">Employee</div>
        <div class="info-card-value">${summary.employee_name}</div>
        <div class="info-card-sub">Emp # ${summary.employee_number || "—"}</div>
      </div>
      <div class="info-card">
        <div class="info-card-title">Pay Period</div>
        <div class="info-card-value">${period}</div>
        <div class="info-card-sub">Generated: ${now}</div>
      </div>
      <div class="info-card">
        <div class="info-card-title">Status</div>
        <div style="margin-top:4px">
          <span class="status-badge" style="background:${statusColor}20;color:${statusColor}">
            ${summary.payout_status.toUpperCase()}
          </span>
        </div>
        ${summary.paid_at ? `<div class="info-card-sub">Paid on ${paidDate}</div>` : ""}
      </div>
      <div class="info-card">
        <div class="info-card-title">Commission Rate</div>
        <div class="info-card-value">${rate}%</div>
        <div class="info-card-sub">Of gross service revenue</div>
      </div>
    </div>

    <!-- Earnings breakdown -->
    <div class="section-title">Earnings Breakdown</div>
    <table class="earn-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Jobs</th>
          <th>Amount (N$)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Gross Service Revenue</td>
          <td>${summary.total_jobs}</td>
          <td>N$ ${revenue}</td>
        </tr>
        <tr>
          <td>Commission (${rate}% of revenue)</td>
          <td>—</td>
          <td>N$ ${commission}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2"><strong>Total Commission Due</strong></td>
          <td><strong>N$ ${commission}</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- Net pay -->
    <div class="net-pay-box">
      <div>
        <div class="net-pay-label">Net Commission Payable</div>
        <div class="net-pay-currency">Namibian Dollar (NAD)</div>
      </div>
      <div class="net-pay-amount">N$ ${commission}</div>
    </div>

    ${summary.notes ? `
    <div class="notes-box">
      <div class="notes-label">Notes</div>
      ${summary.notes}
    </div>` : ""}

    <!-- Footer -->
    <div class="payslip-footer">
      <div class="footer-legal">
        Copyright © ${new Date().getFullYear()} Oasis Pure Cleaning CC · All Rights Reserved<br/>
        This payslip is computer generated and is valid without a signature.
      </div>
      <div class="footer-generated">
        Document Reference<br/>
        ${summary.employee_number || "EMP"}-${summary.month.toString().padStart(2,"0")}-${summary.year}
      </div>
    </div>

  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
