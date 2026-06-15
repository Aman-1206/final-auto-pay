import nodemailer from "nodemailer";
import {
  filterSharedCompanyRecords,
  getCompanyWorkspaceContextForUser
} from "@/lib/company-workspace";
import { resolveDispatchSettings } from "@/lib/dispatch-settings";
import { readDatabase } from "@/lib/storage";
import type { AppDatabase, DispatchSettings, DueRecord, ReminderLog, User } from "@/lib/types";
import { daysBetween, formatCurrency, formatDate } from "@/lib/utils";

type ReportUser = Pick<User, "id" | "companyName" | "name" | "email" | "role">;

function getDay(value: string) {
  return value ? value.slice(0, 10) : "";
}

function logDay(log: ReminderLog) {
  return getDay(log.sentAt || log.scheduledFor || log.createdAt);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((summary, item) => {
    const key = getKey(item) || "Unassigned";
    const entries = summary.get(key) || [];
    entries.push(item);
    summary.set(key, entries);
    return summary;
  }, new Map<string, T[]>());
}

function getSettings(database: AppDatabase, user: ReportUser) {
  const workspace = getCompanyWorkspaceContextForUser(database, user);
  return resolveDispatchSettings(
    database.dispatchSettings.find((entry) => entry.ownerId === workspace.configOwnerId) ?? {
      ownerId: workspace.configOwnerId
    }
  );
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendReportEmail(
  settings: DispatchSettings,
  to: string[],
  subject: string,
  text: string,
  html?: string
) {
  if (settings.simulateMode || to.length === 0) {
    return { simulated: true, recipientCount: to.length };
  }

  if (!settings.smtpHost || !(settings.senderEmail || settings.smtpFrom)) {
    throw new Error("SMTP settings are incomplete for report email.");
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser
      ? {
          user: settings.smtpUser,
          pass: settings.smtpPass
        }
      : undefined
  });

  await transporter.sendMail({
    from: settings.senderEmail || settings.smtpFrom,
    to,
    subject,
    text,
    html
  });

  return { simulated: false, recipientCount: to.length };
}

function buildMetricCard(label: string, value: string | number, accent = "#0f766e") {
  return `
    <td style="width:25%;padding:8px;vertical-align:top;">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa;">
        <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(label)}</div>
        <div style="font-size:22px;font-weight:800;margin-top:6px;color:${accent};">${escapeHtml(value)}</div>
      </div>
    </td>
  `;
}

function buildSectionTitle(title: string) {
  return `<h2 style="font-size:18px;line-height:1.3;margin:24px 0 10px;color:#111827;font-weight:800;">${escapeHtml(title)}</h2>`;
}

function getOverdueDays(due: DueRecord, reportDate: Date) {
  if (!due.dueDate) {
    return 0;
  }

  const dueDate = new Date(due.dueDate);

  if (Number.isNaN(dueDate.getTime())) {
    return 0;
  }

  return Math.max(0, daysBetween(dueDate, reportDate));
}

function buildDailyActivityReportHtml(input: {
  day: string;
  dues: DueRecord[];
  todayLogs: ReminderLog[];
  dealerGroups: Map<string, DueRecord[]>;
  salespersonGroups: Map<string, DueRecord[]>;
  failedLogs: ReminderLog[];
  topOutstanding: Array<{ dealer: string; invoiceCount: number; amount: number }>;
  topOverdue: Array<{
    dealer: string;
    invoiceCount: number;
    amount: number;
    oldestDueDate: string;
    maxOverdueDays: number;
  }>;
}) {
  const {
    day,
    dues,
    todayLogs,
    dealerGroups,
    salespersonGroups,
    failedLogs,
    topOutstanding,
    topOverdue
  } = input;
  const reportDate = new Date(day);
  const currency = dues[0]?.currency || "INR";
  const sentLogs = todayLogs.filter((entry) => entry.status === "sent" || entry.status === "simulated");
  const whatsappSuccess = sentLogs.filter((entry) => entry.channel === "whatsapp").length;
  const whatsappFailed = todayLogs.filter((entry) => entry.channel === "whatsapp" && entry.status === "failed").length;
  const emailSuccess = sentLogs.filter((entry) => entry.channel === "email").length;
  const emailFailed = todayLogs.filter((entry) => entry.channel === "email" && entry.status === "failed").length;
  const failureCount = todayLogs.filter((entry) => entry.status === "failed").length;
  const overdueDues = dues.filter((entry) => getOverdueDays(entry, reportDate) > 0);
  const overdueOutstanding = formatCurrency(
    overdueDues.reduce((sum, entry) => sum + entry.amount, 0),
    currency
  );
  const totalOutstanding = formatCurrency(
    dues.reduce((sum, entry) => sum + entry.amount, 0),
    currency
  );
  const companyCount = new Set(dues.map((entry) => entry.companyName).filter(Boolean)).size;

  const salespersonRows = Array.from(salespersonGroups.entries()).map(([salesperson, records]) => {
    const amount = records.reduce((sum, entry) => sum + entry.amount, 0);
    return `
      <tr>
        <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeHtml(salesperson)}</td>
        <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(records.length)}</td>
        <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;">${escapeHtml(formatCurrency(amount, records[0]?.currency || currency))}</td>
      </tr>
    `;
  });
  const topOutstandingRows = topOutstanding.map((entry, index) => `
    <tr>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:700;">${escapeHtml(index + 1)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeHtml(entry.dealer)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(entry.invoiceCount)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;">${escapeHtml(formatCurrency(entry.amount, currency))}</td>
    </tr>
  `);
  const topOverdueRows = topOverdue.map((entry, index) => `
    <tr>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:700;">${escapeHtml(index + 1)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeHtml(entry.dealer)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(entry.invoiceCount)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#991b1b;font-weight:700;">${escapeHtml(`${entry.maxOverdueDays} days`)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(entry.oldestDueDate ? formatDate(entry.oldestDueDate) : "Not available")}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;">${escapeHtml(formatCurrency(entry.amount, currency))}</td>
    </tr>
  `);
  const failedRows = failedLogs.map((entry) => `
    <tr>
      <td style="padding:11px 13px;border-bottom:1px solid #fee2e2;font-weight:700;color:#991b1b;">${escapeHtml(entry.invoiceNumber || "N/A")}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #fee2e2;color:#7f1d1d;">${escapeHtml(entry.channel)}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #fee2e2;color:#7f1d1d;">${escapeHtml(entry.recipient || "-")}</td>
      <td style="padding:11px 13px;border-bottom:1px solid #fee2e2;color:#7f1d1d;">${escapeHtml(entry.failureReason || "Failed")}</td>
    </tr>
  `);

  const table = (headers: string[], rows: string, emptyText = "No records found.") => `
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          ${headers.map((header, index) => `
            <th align="${index === headers.length - 1 ? "right" : "left"}" style="padding:12px 13px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.03em;font-weight:800;">${escapeHtml(header)}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="${headers.length}" style="padding:14px;color:#6b7280;">${escapeHtml(emptyText)}</td></tr>`}
      </tbody>
    </table>
  `;

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:760px;margin:0 auto;padding:28px 18px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <div style="padding:24px 26px;background:#111827;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#d1d5db;font-weight:700;">Daily Activity Report</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">${escapeHtml(day)}</h1>
            </div>
            <div style="padding:22px 26px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -8px 8px;">
                <tr>
                  ${buildMetricCard("Dealers", dealerGroups.size)}
                  ${buildMetricCard("Companies", companyCount)}
                  ${buildMetricCard("Due Records", dues.length)}
                  ${buildMetricCard("Reminders Sent", sentLogs.length)}
                </tr>
                <tr>
                  ${buildMetricCard("Outstanding", totalOutstanding, "#b45309")}
                  ${buildMetricCard("Overdue Invoices", overdueDues.length, overdueDues.length > 0 ? "#b91c1c" : "#0f766e")}
                  ${buildMetricCard("Overdue Amount", overdueOutstanding, overdueDues.length > 0 ? "#b91c1c" : "#0f766e")}
                  ${buildMetricCard("Dispatch Failures", failureCount, failureCount > 0 ? "#b91c1c" : "#0f766e")}
                </tr>
                <tr>
                  ${buildMetricCard("WhatsApp Success", whatsappSuccess, "#0f766e")}
                  ${buildMetricCard("WhatsApp Failed", whatsappFailed, whatsappFailed > 0 ? "#b91c1c" : "#0f766e")}
                  ${buildMetricCard("Email Success", emailSuccess, "#0f766e")}
                  ${buildMetricCard("Email Failed", emailFailed, emailFailed > 0 ? "#b91c1c" : "#0f766e")}
                </tr>
              </table>

              ${buildSectionTitle("Top Dealers by Outstanding")}
              ${table(["Rank", "Dealer", "Invoices", "Outstanding"], topOutstandingRows.join(""))}

              ${buildSectionTitle("Top Dealers by Overdue Days")}
              ${table(["Rank", "Dealer", "Invoices", "Max Overdue", "Oldest Due", "Outstanding"], topOverdueRows.join(""), "No overdue dealers.")}

              ${buildSectionTitle("Salesperson-wise Summary")}
              ${table(["Salesperson", "Invoices", "Outstanding"], salespersonRows.join(""))}

              ${buildSectionTitle("Failed Dispatch Records")}
              ${table(["Invoice", "Channel", "Recipient", "Reason"], failedRows.join(""), "No failed dispatch records.")}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function buildDailyActivityReport(user: ReportUser, reportDate = new Date()) {
  const database = await readDatabase();
  const workspace = getCompanyWorkspaceContextForUser(database, user);
  const day = reportDate.toISOString().slice(0, 10);
  const dues = filterSharedCompanyRecords(database.dueRecords, workspace.sharedOwnerIds);
  const logs = filterSharedCompanyRecords(database.reminderLogs, workspace.sharedOwnerIds);
  const todayLogs = logs.filter((entry) => logDay(entry) === day);
  const dealerGroups = groupBy(dues, (entry) => entry.companyName || entry.dealerCode);
  const salespersonGroups = groupBy(dues, (entry) => entry.salespersonName || entry.salespersonEmail);
  const failedLogs = todayLogs.filter((entry) => entry.status === "failed");
  const topOutstanding = Array.from(dealerGroups.entries())
    .map(([dealer, records]) => ({
      dealer,
      invoiceCount: records.length,
      amount: records.reduce((sum, entry) => sum + entry.amount, 0)
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10);
  const topOverdue = Array.from(dealerGroups.entries())
    .map(([dealer, records]) => {
      const overdueDays = records.map((entry) => getOverdueDays(entry, reportDate));
      const datedRecords = records
        .filter((entry) => entry.dueDate && !Number.isNaN(new Date(entry.dueDate).getTime()))
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate));

      return {
        dealer,
        invoiceCount: records.length,
        amount: records.reduce((sum, entry) => sum + entry.amount, 0),
        oldestDueDate: datedRecords[0]?.dueDate || "",
        maxOverdueDays: Math.max(0, ...overdueDays)
      };
    })
    .filter((entry) => entry.maxOverdueDays > 0)
    .sort((left, right) => right.maxOverdueDays - left.maxOverdueDays || right.amount - left.amount)
    .slice(0, 10);
  const overdueDues = dues.filter((entry) => getOverdueDays(entry, reportDate) > 0);
  const sentLogs = todayLogs.filter((entry) => entry.status === "sent" || entry.status === "simulated");

  const lines = [
    `Daily Activity Report - ${day}`,
    "",
    `Total Dealers Processed: ${dealerGroups.size}`,
    `Total Companies Processed: ${new Set(dues.map((entry) => entry.companyName).filter(Boolean)).size}`,
    `Total Due Records: ${dues.length}`,
    `Total Reminders Sent: ${sentLogs.length}`,
    `WhatsApp Success Count: ${todayLogs.filter((entry) => entry.channel === "whatsapp" && (entry.status === "sent" || entry.status === "simulated")).length}`,
    `WhatsApp Failure Count: ${todayLogs.filter((entry) => entry.channel === "whatsapp" && entry.status === "failed").length}`,
    `Email Success Count: ${todayLogs.filter((entry) => entry.channel === "email" && (entry.status === "sent" || entry.status === "simulated")).length}`,
    `Email Failure Count: ${todayLogs.filter((entry) => entry.channel === "email" && entry.status === "failed").length}`,
    `Total Outstanding Amount: ${formatCurrency(dues.reduce((sum, entry) => sum + entry.amount, 0), dues[0]?.currency || "INR")}`,
    `Overdue Invoices: ${overdueDues.length}`,
    `Overdue Outstanding Amount: ${formatCurrency(overdueDues.reduce((sum, entry) => sum + entry.amount, 0), dues[0]?.currency || "INR")}`,
    "",
    "Salesperson-wise Summary:",
    ...Array.from(salespersonGroups.entries()).map(([salesperson, records]) => `${salesperson}: ${records.length} invoices, ${formatCurrency(records.reduce((sum, entry) => sum + entry.amount, 0), records[0]?.currency || "INR")}`),
    "",
    "Top Outstanding Dealers:",
    ...topOutstanding.map((entry) => `${entry.dealer}: ${entry.invoiceCount} invoices, ${formatCurrency(entry.amount, dues[0]?.currency || "INR")}`),
    "",
    "Top Dealers by Overdue Days:",
    ...(topOverdue.length === 0
      ? ["None"]
      : topOverdue.map((entry) => `${entry.dealer}: ${entry.maxOverdueDays} days overdue, ${entry.invoiceCount} invoices, oldest due ${entry.oldestDueDate ? formatDate(entry.oldestDueDate) : "Not available"}, ${formatCurrency(entry.amount, dues[0]?.currency || "INR")}`)),
    "",
    "Failed Dispatch Records:",
    ...(failedLogs.length === 0
      ? ["None"]
      : failedLogs.map((entry) => `${entry.invoiceNumber || "N/A"} ${entry.channel} ${entry.recipient}: ${entry.failureReason || "Failed"}`))
  ];

  return {
    date: day,
    settings: getSettings(database, user),
    text: lines.join("\n"),
    html: buildDailyActivityReportHtml({
      day,
      dues,
      todayLogs,
      dealerGroups,
      salespersonGroups,
      failedLogs,
      topOutstanding,
      topOverdue
    })
  };
}

export async function sendDailyActivityReport(user: ReportUser, reportDate = new Date()) {
  const report = await buildDailyActivityReport(user, reportDate);
  const recipients = report.settings.reportRecipients.filter(Boolean);
  const result = await sendReportEmail(
    report.settings,
    recipients,
    `Daily Activity Report - ${report.date}`,
    report.text,
    report.html
  );

  return { ...result, report };
}

export function buildSalespersonSummaryText(name: string, dues: DueRecord[], sentLogs: ReminderLog[]) {
  const dealers = groupBy(dues, (entry) => entry.companyName || entry.dealerCode);
  const contactedDealers = new Set(
    sentLogs.map((entry) => entry.dealerCode).filter(Boolean)
  );
  const outstanding = dues.reduce((sum, entry) => sum + entry.amount, 0);

  return [
    `Salesperson: ${name}`,
    "",
    "Action required: Dealers assigned to you have invoices with due dates coming up or already pending. Please contact each dealer, remind them about the pending invoices, and ask them to arrange payment.",
    "",
    `Assigned Dealers: ${dealers.size}`,
    `Reminders Sent Today: ${sentLogs.length}`,
    `Pending Dealers: ${Math.max(0, dealers.size - contactedDealers.size)}`,
    `Total Outstanding: ${formatCurrency(outstanding, dues[0]?.currency || "INR")}`,
    "",
    "Dealer Breakdown:",
    ...Array.from(dealers.entries()).map(([dealer, records]) => {
      const amount = records.reduce((sum, entry) => sum + entry.amount, 0);
      const nextDue = records
        .map((entry) => entry.dueDate)
        .filter(Boolean)
        .sort()[0];
      const invoices = records
        .map((entry) => entry.invoiceNumber || entry.reference)
        .filter(Boolean)
        .join(", ");
      return [
        dealer,
        `Due date: ${nextDue ? formatDate(nextDue) : "Not available"}`,
        `Invoices: ${invoices || "N/A"}`,
        `Outstanding: ${formatCurrency(amount, records[0]?.currency || "INR")}`,
        "Action: Contact this dealer and ask them to clear the pending payment."
      ].join("\n");
    })
  ].join("\n");
}

export function buildSalespersonSummaryHtml(name: string, dues: DueRecord[], sentLogs: ReminderLog[]) {
  const dealers = groupBy(dues, (entry) => entry.companyName || entry.dealerCode);
  const contactedDealers = new Set(
    sentLogs.map((entry) => entry.dealerCode).filter(Boolean)
  );
  const outstanding = dues.reduce((sum, entry) => sum + entry.amount, 0);
  const currency = dues[0]?.currency || "INR";
  const rows = Array.from(dealers.entries()).map(([dealer, records]) => {
    const amount = records.reduce((sum, entry) => sum + entry.amount, 0);
    const nextDue = records
      .map((entry) => entry.dueDate)
      .filter(Boolean)
      .sort()[0];
    const invoices = records
      .map((entry) => entry.invoiceNumber || entry.reference)
      .filter(Boolean)
      .join(", ");

    return `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;">${escapeHtml(dealer)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(records.length)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-weight:600;">${escapeHtml(nextDue ? formatDate(nextDue) : "Not available")}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">${escapeHtml(invoices || "-")}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:700;text-align:right;">${escapeHtml(formatCurrency(amount, records[0]?.currency || currency))}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#0f766e;font-weight:700;">Contact dealer for payment</td>
      </tr>
    `;
  });

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:720px;margin:0 auto;padding:28px 18px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <div style="padding:24px 26px;background:#0f766e;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;opacity:.9;">Salesperson Reminder Summary</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(name)}</h1>
            </div>

            <div style="padding:22px 26px;">
              <div style="border:1px solid #99f6e4;background:#f0fdfa;border-radius:8px;padding:16px 18px;margin-bottom:20px;">
                <div style="font-size:13px;color:#0f766e;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">Action Required</div>
                <p style="margin:7px 0 0;color:#134e4a;line-height:1.55;font-weight:600;">
                  Dealers assigned to you have invoices with due dates coming up or pending. Please contact each dealer, remind them about the pending invoices, and ask them to arrange payment.
                </p>
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:22px;">
                <tr>
                  <td style="width:25%;padding:10px;">
                    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa;">
                      <div style="font-size:12px;color:#6b7280;">Assigned Dealers</div>
                      <div style="font-size:24px;font-weight:700;margin-top:4px;">${escapeHtml(dealers.size)}</div>
                    </div>
                  </td>
                  <td style="width:25%;padding:10px;">
                    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa;">
                      <div style="font-size:12px;color:#6b7280;">Sent Today</div>
                      <div style="font-size:24px;font-weight:700;margin-top:4px;">${escapeHtml(sentLogs.length)}</div>
                    </div>
                  </td>
                  <td style="width:25%;padding:10px;">
                    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa;">
                      <div style="font-size:12px;color:#6b7280;">Pending Dealers</div>
                      <div style="font-size:24px;font-weight:700;margin-top:4px;">${escapeHtml(Math.max(0, dealers.size - contactedDealers.size))}</div>
                    </div>
                  </td>
                  <td style="width:25%;padding:10px;">
                    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa;">
                      <div style="font-size:12px;color:#6b7280;">Outstanding</div>
                      <div style="font-size:20px;font-weight:700;margin-top:4px;">${escapeHtml(formatCurrency(outstanding, currency))}</div>
                    </div>
                  </td>
                </tr>
              </table>

              <h2 style="font-size:18px;margin:0 0 12px;">Dealer Breakdown</h2>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th align="left" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;">Dealer</th>
                    <th align="left" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;">Invoices</th>
                    <th align="left" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;">Due Date</th>
                    <th align="left" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;">Invoice Nos.</th>
                    <th align="right" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;">Outstanding</th>
                    <th align="left" style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.join("") || `<tr><td colspan="6" style="padding:14px;color:#6b7280;">No assigned dues found.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendSalespersonSummaries(user: ReportUser, sentLogs: ReminderLog[]) {
  const database = await readDatabase();
  const workspace = getCompanyWorkspaceContextForUser(database, user);
  const settings = getSettings(database, user);
  const dues = filterSharedCompanyRecords(database.dueRecords, workspace.sharedOwnerIds);
  const groups = groupBy(
    dues.filter((entry) => entry.salespersonEmail),
    (entry) => entry.salespersonEmail
  );
  const results: Array<{ email: string; simulated: boolean; recipientCount: number }> = [];

  for (const [email, records] of groups.entries()) {
    const name = records[0]?.salespersonName || email;
    const salespersonLogs = sentLogs.filter((log) =>
      records.some((due) => due.id === log.dueId || due.dealerCode === log.dealerCode)
    );

    const result = await sendReportEmail(
      settings,
      [email],
      `Reminder Summary - ${name}`,
      buildSalespersonSummaryText(name, records, salespersonLogs),
      buildSalespersonSummaryHtml(name, records, salespersonLogs)
    );
    results.push({ email, ...result });
  }

  return results;
}
