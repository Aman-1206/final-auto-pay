import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdminUser } from "@/lib/auth";
import { resolveDispatchSettings } from "@/lib/dispatch-settings";
import { readDatabase } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const templateTokens = [
  "{{contactName}}",
  "{{companyName}}",
  "{{invoiceNumber}}",
  "{{reference}}",
  "{{billDate}}",
  "{{dueDate}}",
  "{{pendingAmount}}",
  "{{openingAmount}}",
  "{{billAgeDays}}",
  "{{overdueDays}}",
  "{{reminderDay}}",
  "{{cdSummary}}",
  "{{cdMessage}}",
  "{{cdShortMessage}}",
  "{{cdShortSummary}}",
  "{{cdEligible}}",
  "{{cdDiscountPercent}}",
  "{{cdPolicyWindowDays}}",
  "{{cdReason}}",
  "{{senderCompany}}"
];

function getQueryValue(input: string | string[] | undefined) {
  return typeof input === "string" ? input : Array.isArray(input) ? input[0] || "" : "";
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function summarizeUserAgent(value: string) {
  if (!value) {
    return "Unknown device";
  }

  return value.length > 84 ? `${value.slice(0, 81)}...` : value;
}

function getReminderActivityTimestamp(log: {
  sentAt: string;
  scheduledFor: string;
  createdAt: string;
}) {
  return log.sentAt || log.scheduledFor || log.createdAt;
}

function getReminderActivityDay(log: {
  sentAt: string;
  scheduledFor: string;
  createdAt: string;
}) {
  return getReminderActivityTimestamp(log).slice(0, 10);
}

function getReminderPayloadBytes(log: {
  subject: string;
  content: string;
  recipient: string;
}) {
  return new TextEncoder().encode(
    [log.subject, log.content, log.recipient].filter(Boolean).join("\n")
  ).length;
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);
  const settings = resolveDispatchSettings(
    database.dispatchSettings.find((entry) => entry.ownerId === user.id) ?? { ownerId: user.id }
  );
  const rules = database.reminderRules
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => left.triggerDay - right.triggerDay);
  const templates = database.templates.filter((entry) => entry.ownerId === user.id);
  const policies = database.cashDiscountPolicies
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => left.paymentWindowDays - right.paymentWindowDays);
  const selectedActivityDayInput = getQueryValue(params.activityDay);
  const selectedActivityDay = /^\d{4}-\d{2}-\d{2}$/.test(selectedActivityDayInput)
    ? selectedActivityDayInput
    : "";
  const now = Date.now();
  const usersById = new Map(database.users.map((entry) => [entry.id, entry]));
  const activeSessions = database.sessions
    .filter((entry) => new Date(entry.expiresAt).getTime() > now)
    .map((entry) => ({
      ...entry,
      user: usersById.get(entry.userId) ?? null
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const authEvents = [...database.authEvents]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 40);
  const allReminderLogs = [...database.reminderLogs].sort(
    (left, right) =>
      getReminderActivityTimestamp(right).localeCompare(getReminderActivityTimestamp(left))
  );
  const deliveredReminderLogs = allReminderLogs.filter((entry) => entry.status !== "pending");
  const totalPayloadBytes = deliveredReminderLogs.reduce(
    (sum, entry) => sum + getReminderPayloadBytes(entry),
    0
  );
  const reminderActivityByDay = Array.from(
    allReminderLogs.reduce((summary, log) => {
      const day = getReminderActivityDay(log) || "unknown";
      const current = summary.get(day) ?? {
        day,
        total: 0,
        pending: 0,
        sent: 0,
        simulated: 0,
        failed: 0,
        payloadBytes: 0
      };

      current.total += 1;
      current[log.status] += 1;

      if (log.status !== "pending") {
        current.payloadBytes += getReminderPayloadBytes(log);
      }

      summary.set(day, current);
      return summary;
    }, new Map<string, {
      day: string;
      total: number;
      pending: number;
      sent: number;
      simulated: number;
      failed: number;
      payloadBytes: number;
    }>())
  )
    .map(([, value]) => value)
    .sort((left, right) => right.day.localeCompare(left.day));
  const visibleReminderActivityByDay = reminderActivityByDay.slice(0, 21);
  const filteredReminderLogs = (
    selectedActivityDay
      ? allReminderLogs.filter((entry) => getReminderActivityDay(entry) === selectedActivityDay)
      : allReminderLogs
  ).slice(0, 60);

  return (
    <DashboardShell
      title="Admin dashboard"
      description="Manage provider credentials, bill-age reminder templates, and cash discount rules from one admin workspace."
      companyName={user.companyName}
      userName={user.name}
      isAdmin
    >
      <StatusBar params={params} />

      <section className="stats-grid">
        <article className="stat-card glass-panel">
          <span className="stat-label">Reminder Rules</span>
          <strong>{rules.length}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Templates</span>
          <strong>{templates.length}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">CD Policies</span>
          <strong>{policies.length}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Mode</span>
          <strong>{settings.simulateMode ? "Simulate" : "Live"}</strong>
        </article>
      </section>

      <section className="stats-grid">
        <article className="stat-card glass-panel">
          <span className="stat-label">Active Sessions</span>
          <strong>{activeSessions.length}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Users</span>
          <strong>{database.users.length}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Reminder Sends</span>
          <strong>{deliveredReminderLogs.length}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Payload Sent</span>
          <strong>{formatBytes(totalPayloadBytes)}</strong>
        </article>
      </section>

      <section className="stacked-layout">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Admin activity</h2>
            <p>
              Live session visibility, authentication history, and reminder delivery volume for
              the whole workspace.
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Logged in</th>
                  <th>Expires</th>
                  <th>IP</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No active sessions found.</td>
                  </tr>
                ) : (
                  activeSessions.map((session) => (
                    <tr key={`${session.userId}-${session.token}`}>
                      <td>{session.user?.name || "Unknown user"}</td>
                      <td>{session.user?.role || "-"}</td>
                      <td>{session.user?.email || "-"}</td>
                      <td>{formatDateTime(session.createdAt)}</td>
                      <td>{formatDateTime(session.expiresAt)}</td>
                      <td>{session.ipAddress || "Unknown"}</td>
                      <td>{summarizeUserAgent(session.userAgent)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Authentication history</h2>
            <p>
              Latest login and logout events captured from the auth routes with timestamps and
              device metadata.
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Session</th>
                  <th>IP</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {authEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No auth history captured yet.</td>
                  </tr>
                ) : (
                  authEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.createdAt)}</td>
                      <td>
                        <div className="stacked-layout">
                          <strong>{event.userName}</strong>
                          <span className="muted-copy">{event.userEmail}</span>
                        </div>
                      </td>
                      <td>
                        <span className="dispatch-badge">
                          {event.type === "login" ? "Login" : "Logout"}
                        </span>
                      </td>
                      <td>...{event.sessionTokenSuffix}</td>
                      <td>{event.ipAddress || "Unknown"}</td>
                      <td>{summarizeUserAgent(event.userAgent)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Reminder volume by day</h2>
            <p>
              Days are sorted newest first. Payload is estimated from stored subject, message
              body, and recipient values for non-pending sends.
            </p>
          </div>

          <form method="get" className="dispatch-form">
            <div className="dispatch-form-grid">
              <label className="field">
                <span>Filter detailed logs by day</span>
                <input name="activityDay" type="date" defaultValue={selectedActivityDay} />
              </label>
            </div>

            <div className="button-row">
              <button className="button" type="submit">
                Apply day filter
              </button>
              <Link className="button button-ghost" href="/dashboard/settings">
                Clear filter
              </Link>
            </div>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Total</th>
                  <th>Sent</th>
                  <th>Simulated</th>
                  <th>Failed</th>
                  <th>Pending</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {visibleReminderActivityByDay.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No reminder activity yet.</td>
                  </tr>
                ) : (
                  visibleReminderActivityByDay.map((entry) => (
                    <tr key={entry.day}>
                      <td>{entry.day === "unknown" ? "Unknown" : formatDate(entry.day)}</td>
                      <td>{entry.total}</td>
                      <td>{entry.sent}</td>
                      <td>{entry.simulated}</td>
                      <td>{entry.failed}</td>
                      <td>{entry.pending}</td>
                      <td>{formatBytes(entry.payloadBytes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Reminder activity log</h2>
            <p>
              {selectedActivityDay
                ? `Showing up to 60 reminder log entries for ${formatDate(selectedActivityDay)}.`
                : "Showing the latest 60 reminder log entries across all days."}
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Invoice</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Recipient</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {filteredReminderLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No reminder logs match the selected day.</td>
                  </tr>
                ) : (
                  filteredReminderLogs.map((log) => {
                    const owner = usersById.get(log.ownerId);

                    return (
                      <tr key={log.id}>
                        <td>{formatDateTime(getReminderActivityTimestamp(log))}</td>
                        <td>{owner?.name || owner?.email || "Unknown user"}</td>
                        <td>{log.invoiceNumber || "-"}</td>
                        <td>
                          <span className="dispatch-badge">{log.channel}</span>
                        </td>
                        <td>
                          <span className={`dispatch-badge dispatch-status-${log.status}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>{log.recipient || "-"}</td>
                        <td>
                          {log.status === "pending"
                            ? "-"
                            : formatBytes(getReminderPayloadBytes(log))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="stacked-layout">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Communication providers</h2>
            <p>
              Save the SMTP, sender number, SMS, and WhatsApp credentials your dispatch center
              will use. Values from `env.local` appear here until you override them in admin.
            </p>
          </div>

          <form action="/api/providers/save" method="post" className="dispatch-form">
            <label className="checkbox-field dispatch-check">
              <input
                name="simulateMode"
                type="checkbox"
                defaultChecked={settings.simulateMode}
              />
              <span>Keep simulation mode enabled until every provider is confirmed</span>
            </label>

            <div className="dispatch-form-grid">
              <label className="field">
                <span>Sender email</span>
                <input
                  name="senderEmail"
                  type="email"
                  defaultValue={settings.senderEmail || settings.smtpFrom}
                />
              </label>

              <label className="field">
                <span>Sender mobile number</span>
                <input
                  name="senderMobileNumber"
                  type="text"
                  defaultValue={settings.senderMobileNumber}
                />
              </label>

              <label className="field">
                <span>SMTP host</span>
                <input name="smtpHost" type="text" defaultValue={settings.smtpHost} />
              </label>

              <label className="field">
                <span>SMTP port</span>
                <input
                  name="smtpPort"
                  type="number"
                  min={1}
                  defaultValue={settings.smtpPort}
                />
              </label>

              <label className="field">
                <span>SMTP username</span>
                <input name="smtpUser" type="text" defaultValue={settings.smtpUser} />
              </label>

              <label className="field">
                <span>SMTP password</span>
                <input name="smtpPass" type="password" defaultValue={settings.smtpPass} />
              </label>

              <label className="field">
                <span>SMS provider</span>
                <input
                  name="smsProviderName"
                  type="text"
                  defaultValue={settings.smsProviderName}
                />
              </label>

              <label className="field">
                <span>SMS sender number</span>
                <input
                  name="smsFromNumber"
                  type="text"
                  defaultValue={settings.smsFromNumber}
                  placeholder="+14155550123"
                />
              </label>

              <label className="field">
                <span>SMS sender ID</span>
                <input
                  name="smsSenderId"
                  type="text"
                  defaultValue={settings.smsSenderId}
                />
              </label>

              <label className="field">
                <span>SMS API key</span>
                <input name="smsApiKey" type="text" defaultValue={settings.smsApiKey} />
              </label>

              <label className="field">
                <span>SMS API secret</span>
                <input
                  name="smsApiSecret"
                  type="password"
                  defaultValue={settings.smsApiSecret}
                />
              </label>

              <label className="field">
                <span>SMS account SID</span>
                <input
                  name="smsAccountSid"
                  type="text"
                  defaultValue={settings.smsAccountSid}
                />
              </label>

              <label className="field">
                <span>SMS auth token</span>
                <input
                  name="smsAuthToken"
                  type="password"
                  defaultValue={settings.smsAuthToken}
                />
              </label>

              <label className="field">
                <span>WhatsApp provider</span>
                <input
                  name="whatsappProviderName"
                  type="text"
                  defaultValue={settings.whatsappProviderName}
                />
              </label>

              <label className="field">
                <span>WhatsApp sender</span>
                <input
                  name="whatsappFromNumber"
                  type="text"
                  defaultValue={settings.whatsappFromNumber}
                  placeholder="+14155238886"
                />
              </label>

              <label className="field">
                <span>WhatsApp API key</span>
                <input
                  name="whatsappApiKey"
                  type="text"
                  defaultValue={settings.whatsappApiKey}
                />
              </label>

              <label className="field">
                <span>WhatsApp API secret</span>
                <input
                  name="whatsappApiSecret"
                  type="password"
                  defaultValue={settings.whatsappApiSecret}
                />
              </label>

              <label className="field">
                <span>WhatsApp account SID</span>
                <input
                  name="whatsappAccountSid"
                  type="text"
                  defaultValue={settings.whatsappAccountSid}
                />
              </label>

              <label className="field">
                <span>WhatsApp auth token</span>
                <input
                  name="whatsappAuthToken"
                  type="password"
                  defaultValue={settings.whatsappAuthToken}
                />
              </label>

              <label className="field rule-span">
                <span>WhatsApp webhook URL</span>
                <input
                  name="whatsappWebhookUrl"
                  type="url"
                  defaultValue={settings.whatsappWebhookUrl}
                />
              </label>
            </div>

            <label className="checkbox-field dispatch-check">
              <input
                name="smtpSecure"
                type="checkbox"
                defaultChecked={settings.smtpSecure}
              />
              <span>Use secure SMTP when your provider requires it</span>
            </label>

            <label className="field">
              <span>Future integration notes</span>
              <textarea
                name="futureIntegrationNotes"
                rows={5}
                defaultValue={settings.futureIntegrationNotes}
                placeholder="Use this space for provider rollout notes, webhook plans, or future channel requirements."
              />
            </label>

            <button className="button" type="submit">
              Save communication settings
            </button>
          </form>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Template tokens</h2>
            <p>
              These placeholders can be used inside email, WhatsApp, and SMS templates saved
              below.
            </p>
          </div>

          <div className="button-row">
            {templateTokens.map((token) => (
              <code key={token}>{token}</code>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Create reminder rule</h2>
            <p>
              Rules are triggered from bill age calculated in the backend using the due sheet
              `Date` column, not from the sheet&apos;s overdue value.
            </p>
          </div>

          <form action="/api/rules/save" method="post" className="rule-grid">
            <input type="hidden" name="ruleId" value="" />
            <input type="hidden" name="templateId" value="" />

            <label className="field">
              <span>Rule name</span>
              <input name="name" type="text" placeholder="25 Day Reminder" required />
            </label>

            <label className="field">
              <span>Trigger day</span>
              <input name="triggerDay" type="number" min={1} placeholder="25" required />
            </label>

            <label className="checkbox-field">
              <input name="enabled" type="checkbox" defaultChecked />
              <span>Enabled</span>
            </label>

            <label className="checkbox-field">
              <input name="autoSend" type="checkbox" />
              <span>Auto-send when generated</span>
            </label>

            <label className="checkbox-field">
              <input name="channelEmail" type="checkbox" defaultChecked />
              <span>Email</span>
            </label>

            <label className="checkbox-field">
              <input name="channelWhatsapp" type="checkbox" defaultChecked />
              <span>WhatsApp</span>
            </label>

            <label className="checkbox-field">
              <input name="channelSms" type="checkbox" />
              <span>SMS</span>
            </label>

            <label className="field rule-span">
              <span>Email subject</span>
              <input
                name="emailSubject"
                type="text"
                placeholder="Payment reminder: invoice {{invoiceNumber}} now at {{billAgeDays}} days"
                required
              />
            </label>

            <label className="field rule-span">
              <span>Email body</span>
              <textarea
                name="emailBody"
                rows={8}
                defaultValue={`Dear {{contactName}},

This is a reminder for invoice {{invoiceNumber}} dated {{billDate}} for {{companyName}} with pending amount {{pendingAmount}}.
Reference number: {{reference}}.

The bill has now aged {{billAgeDays}} days, and this reminder was triggered by your day {{reminderDay}} rule.

{{cdMessage}}

Regards,
{{senderCompany}}`}
                required
              />
            </label>

            <label className="field">
              <span>WhatsApp template</span>
              <textarea
                name="whatsappBody"
                rows={5}
                defaultValue="Hello {{contactName}}, invoice {{invoiceNumber}} for {{companyName}} has pending amount {{pendingAmount}}. Ref: {{reference}}. The bill is now {{billAgeDays}} days old. {{cdShortMessage}}"
                required
              />
            </label>

            <label className="field">
              <span>SMS template</span>
              <textarea
                name="smsBody"
                rows={5}
                defaultValue="Reminder: invoice {{invoiceNumber}} for {{companyName}} has pending amount {{pendingAmount}}. Ref: {{reference}}. The bill is now {{billAgeDays}} days old. {{cdShortMessage}}"
                required
              />
            </label>

            <div className="rule-span">
              <button className="button" type="submit">
                Save reminder rule
              </button>
            </div>
          </form>
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

              <form action="/api/rules/save" method="post" className="rule-grid">
                <input type="hidden" name="ruleId" value={rule.id} />
                <input type="hidden" name="templateId" value={template.id} />

                <label className="field">
                  <span>Rule name</span>
                  <input name="name" type="text" defaultValue={rule.name} required />
                </label>

                <label className="field">
                  <span>Trigger day</span>
                  <input
                    name="triggerDay"
                    type="number"
                    min={1}
                    defaultValue={rule.triggerDay}
                    required
                  />
                </label>

                <label className="checkbox-field">
                  <input name="enabled" type="checkbox" defaultChecked={rule.enabled} />
                  <span>Enabled</span>
                </label>

                <label className="checkbox-field">
                  <input name="autoSend" type="checkbox" defaultChecked={rule.autoSend} />
                  <span>Auto-send when generated</span>
                </label>

                <label className="checkbox-field">
                  <input
                    name="channelEmail"
                    type="checkbox"
                    defaultChecked={rule.channels.email}
                  />
                  <span>Email</span>
                </label>

                <label className="checkbox-field">
                  <input
                    name="channelWhatsapp"
                    type="checkbox"
                    defaultChecked={rule.channels.whatsapp}
                  />
                  <span>WhatsApp</span>
                </label>

                <label className="checkbox-field">
                  <input
                    name="channelSms"
                    type="checkbox"
                    defaultChecked={rule.channels.sms}
                  />
                  <span>SMS</span>
                </label>

                <label className="field rule-span">
                  <span>Email subject</span>
                  <input
                    name="emailSubject"
                    type="text"
                    defaultValue={template.emailSubject}
                    required
                  />
                </label>

                <label className="field rule-span">
                  <span>Email body</span>
                  <textarea
                    name="emailBody"
                    rows={8}
                    defaultValue={template.emailBody}
                    required
                  />
                </label>

                <label className="field">
                  <span>WhatsApp template</span>
                  <textarea
                    name="whatsappBody"
                    rows={5}
                    defaultValue={template.whatsappBody}
                    required
                  />
                </label>

                <label className="field">
                  <span>SMS template</span>
                  <textarea
                    name="smsBody"
                    rows={5}
                    defaultValue={template.smsBody}
                    required
                  />
                </label>

                <div className="button-row rule-span">
                  <button className="button" type="submit">
                    Update rule
                  </button>
                </div>
              </form>

              <form action="/api/rules/delete" method="post">
                <input type="hidden" name="ruleId" value={rule.id} />
                <button className="button button-ghost" type="submit">
                  Delete rule
                </button>
              </form>
            </article>
          );
        })}

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Create cash discount policy</h2>
            <p>
              `CD` is evaluated dynamically from bill date. A bill stays eligible only when it is
              inside the configured day window and there are no older unpaid bills for that same
              company or dealer.
            </p>
          </div>

          <form action="/api/policies/save" method="post" className="rule-grid">
            <input type="hidden" name="policyId" value="" />

            <label className="field">
              <span>Policy name</span>
              <input name="name" type="text" placeholder="30 Day CD" required />
            </label>

            <label className="field">
              <span>Payment window days</span>
              <input name="paymentWindowDays" type="number" min={1} placeholder="30" required />
            </label>

            <label className="field">
              <span>Discount percent</span>
              <input
                name="discountPercent"
                type="number"
                min={0.01}
                step="0.01"
                placeholder="2"
                required
              />
            </label>

            <label className="checkbox-field">
              <input name="enabled" type="checkbox" defaultChecked />
              <span>Enabled</span>
            </label>

            <label className="field rule-span">
              <span>Description</span>
              <textarea
                name="description"
                rows={4}
                defaultValue="Customer remains eligible only when payment is made within the configured window and no older unpaid invoices exist."
                required
              />
            </label>

            <div className="rule-span">
              <button className="button" type="submit">
                Save CD policy
              </button>
            </div>
          </form>
        </article>

        {policies.map((policy) => (
          <article key={policy.id} className="glass-panel">
            <div className="section-heading">
              <h2>{policy.name}</h2>
              <p>
                {policy.discountPercent}% discount within {policy.paymentWindowDays} days.
              </p>
            </div>

            <form action="/api/policies/save" method="post" className="rule-grid">
              <input type="hidden" name="policyId" value={policy.id} />

              <label className="field">
                <span>Policy name</span>
                <input name="name" type="text" defaultValue={policy.name} required />
              </label>

              <label className="field">
                <span>Payment window days</span>
                <input
                  name="paymentWindowDays"
                  type="number"
                  min={1}
                  defaultValue={policy.paymentWindowDays}
                  required
                />
              </label>

              <label className="field">
                <span>Discount percent</span>
                <input
                  name="discountPercent"
                  type="number"
                  min={0.01}
                  step="0.01"
                  defaultValue={policy.discountPercent}
                  required
                />
              </label>

              <label className="checkbox-field">
                <input name="enabled" type="checkbox" defaultChecked={policy.enabled} />
                <span>Enabled</span>
              </label>

              <label className="field rule-span">
                <span>Description</span>
                <textarea name="description" rows={4} defaultValue={policy.description} required />
              </label>

              <div className="button-row rule-span">
                <button className="button" type="submit">
                  Update CD policy
                </button>
              </div>
            </form>

            <form action="/api/policies/delete" method="post">
              <input type="hidden" name="policyId" value={policy.id} />
              <button className="button button-ghost" type="submit">
                Delete policy
              </button>
            </form>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}

function StatusBar({ params }: { params: Record<string, string | string[] | undefined> }) {
  const message = typeof params.message === "string" ? params.message : "";
  const error = typeof params.error === "string" ? params.error : "";

  if (!message && !error) {
    return null;
  }

  return (
    <p className={`status-banner ${error ? "status-error" : "status-success"}`}>
      {decodeURIComponent(error || message)}
    </p>
  );
}
