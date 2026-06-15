import { DashboardShell } from "@/components/dashboard-shell";
import { ProtectedSubmitButton } from "@/components/protected-submit-button";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { readDatabase } from "@/lib/storage";
import type { ReminderRule, ReminderTemplate } from "@/lib/types";

const tokens = [
  "{{amount}}",
  "{{billAgeDays}}",
  "{{billDate}}",
  "{{cdDiscountPercent}}",
  "{{cdEligible}}",
  "{{cdMessage}}",
  "{{cdPolicyWindowDays}}",
  "{{cdReason}}",
  "{{cdShortMessage}}",
  "{{cdShortSummary}}",
  "{{cdSummary}}",
  "{{companyBillKey}}",
  "{{companyName}}",
  "{{company_name}}",
  "{{contactName}}",
  "{{currentInvoiceDueAmount}}",
  "{{current_invoice_due_amount}}",
  "{{daysBeforeDue}}",
  "{{dealerCode}}",
  "{{dealer_name}}",
  "{{dueDate}}",
  "{{due_date}}",
  "{{invoiceAmount}}",
  "{{invoiceNumber}}",
  "{{invoice_amount}}",
  "{{invoice_no}}",
  "{{openingAmount}}",
  "{{overdueDays}}",
  "{{pendingAmount}}",
  "{{previousDueAmount}}",
  "{{previous_due_amount}}",
  "{{reference}}",
  "{{reminderDay}}",
  "{{senderCompany}}",
  "{{totalDueAmount}}",
  "{{total_due_amount}}"
];

const defaultEmailBody = `Dear {{dealer_name}},

This is a reminder regarding Invoice {{invoice_no}} for {{invoice_amount}} due on {{due_date}}.

Current invoice due: {{current_invoice_due_amount}}.
Previous due: {{previous_due_amount}}.
Total due amount: {{total_due_amount}}.
Bill age: {{billAgeDays}} days.

{{cdMessage}}

Kindly arrange payment at the earliest.

Thank you,
{{senderCompany}}`;

export default async function MessageTemplatesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);
  const workspace = getCompanyWorkspaceContextForUser(database, user);
  const rules = database.reminderRules
    .filter((entry) => entry.ownerId === workspace.configOwnerId)
    .sort((left, right) => left.triggerDay - right.triggerDay);
  const templates = database.templates.filter((entry) => entry.ownerId === workspace.configOwnerId);

  return (
    <DashboardShell
      title="Message templates"
      description="Manage reminder rules, channels, and placeholder-based message bodies."
      companyName={user.companyName}
      userName={user.name}
      isAdmin
      userRole={user.role}
      canSendManualReminders={user.canSendManualReminders}
    >
      <StatusBar params={params} />

      <article className="glass-panel">
        <div className="section-heading">
          <h2>Supported placeholders</h2>
          <p>Use these tokens in email, WhatsApp, and SMS templates.</p>
        </div>
        <div className="button-row">
          {tokens.map((token) => (
            <code key={token}>{token}</code>
          ))}
        </div>
      </article>

      <section className="stacked-layout">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Create reminder rule</h2>
            <p>Rules can be generated automatically or used manually from the dues page.</p>
          </div>
          <RuleForm />
        </article>

        {rules.map((rule) => {
          const template = templates.find((entry) => entry.id === rule.templateId);
          if (!template) {
            return null;
          }
          return (
            <article key={rule.id} className="glass-panel">
              <div className="section-heading">
                <h2>{rule.name}</h2>
                <p>Triggers when bill age reaches {rule.triggerDay} days.</p>
              </div>
              <RuleForm rule={rule} template={template} />
              <form action="/api/rules/delete" method="post" className="compact-form">
                <input type="hidden" name="ruleId" value={rule.id} />
                <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
                <ProtectedSubmitButton
                  className="button button-ghost"
                  confirmationMessage={`Delete ${rule.name}?`}
                >
                  Delete rule
                </ProtectedSubmitButton>
              </form>
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}

function RuleForm({ rule, template }: { rule?: ReminderRule; template?: ReminderTemplate }) {
  return (
    <form action="/api/rules/save" method="post" className="rule-grid">
      <input type="hidden" name="ruleId" value={rule?.id || ""} />
      <input type="hidden" name="templateId" value={template?.id || ""} />
      <label className="field">
        <span>Rule name</span>
        <input name="name" defaultValue={rule?.name || ""} required />
      </label>
      <label className="field">
        <span>Trigger day</span>
        <input name="triggerDay" type="number" min={1} defaultValue={rule?.triggerDay || ""} required />
      </label>
      <label className="checkbox-field">
        <input name="enabled" type="checkbox" defaultChecked={rule?.enabled ?? true} />
        <span>Enabled</span>
      </label>
      <label className="checkbox-field">
        <input name="autoSend" type="checkbox" defaultChecked={rule?.autoSend ?? false} />
        <span>Auto-send when generated</span>
      </label>
      <label className="checkbox-field">
        <input name="channelEmail" type="checkbox" defaultChecked={rule?.channels.email ?? true} />
        <span>Email</span>
      </label>
      <label className="checkbox-field">
        <input name="channelWhatsapp" type="checkbox" defaultChecked={rule?.channels.whatsapp ?? true} />
        <span>WhatsApp</span>
      </label>
      <label className="checkbox-field">
        <input name="channelSms" type="checkbox" defaultChecked={rule?.channels.sms ?? false} />
        <span>SMS</span>
      </label>
      <label className="field rule-span">
        <span>Email subject</span>
        <input name="emailSubject" defaultValue={template?.emailSubject || "Payment reminder: {{invoice_no}}"} required />
      </label>
      <label className="field rule-span">
        <span>Email body</span>
        <textarea name="emailBody" rows={8} defaultValue={template?.emailBody || defaultEmailBody} required />
      </label>
      <label className="field">
        <span>WhatsApp template</span>
        <textarea name="whatsappBody" rows={5} defaultValue={template?.whatsappBody || "Dear {{dealer_name}}, reminder for {{invoice_no}} amount {{invoice_amount}}. Previous due: {{previous_due_amount}}. Total due: {{total_due_amount}}."} required />
      </label>
      <label className="field">
        <span>SMS template</span>
        <textarea name="smsBody" rows={5} defaultValue={template?.smsBody || "Reminder {{invoice_no}}: {{invoice_amount}} due. Previous due {{previous_due_amount}}. Total due {{total_due_amount}}."} required />
      </label>
      <label className="field rule-span">
        <span>Admin settings password</span>
        <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
      </label>
      <div className="rule-span">
        <ProtectedSubmitButton className="button">
          Save rule
        </ProtectedSubmitButton>
      </div>
    </form>
  );
}

function StatusBar({ params }: { params: Record<string, string | string[] | undefined> }) {
  const message = typeof params.message === "string" ? params.message : "";
  const error = typeof params.error === "string" ? params.error : "";
  return message || error ? (
    <p className={`status-banner ${error ? "status-error" : "status-success"}`}>
      {decodeURIComponent(error || message)}
    </p>
  ) : null;
}
