import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { readDatabase } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export default async function DispatchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);
  const envSmsFromNumber = process.env.TWILIO_FROM_NUMBER || "";
  const envWhatsappFromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER || "";

  const settings = database.dispatchSettings.find((entry) => entry.ownerId === user.id);
  const dueRecords = database.dueRecords
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const rules = database.reminderRules
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => right.daysBeforeDue - left.daysBeforeDue);
  const dueRecordMap = new Map(dueRecords.map((entry) => [entry.id, entry]));
  const ruleMap = new Map(rules.map((entry) => [entry.id, entry]));
  const allReminderLogs = database.reminderLogs
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const reminderLogs = allReminderLogs.slice(0, 20);
  const pendingCount = allReminderLogs.filter((entry) => entry.status === "pending").length;
  const failedCount = allReminderLogs.filter((entry) => entry.status === "failed").length;
  const deliveredCount = allReminderLogs.filter(
    (entry) => entry.status === "sent" || entry.status === "simulated"
  ).length;

  return (
    <DashboardShell
      title="Dispatch center"
      description="Generate reminders only when you choose, review the day-based queue, and send it when you are ready."
    >
      <section className="dispatch-shell">
        <StatusBar params={params} />

        <article className="dispatch-hero">
          <div className="dispatch-hero-copy">
            <span className="dispatch-kicker">Twilio dispatch</span>
            <h2>One quiet place to control email, SMS, and WhatsApp sends.</h2>
            <p>
              Keep simulate mode on while testing templates. When you are ready, add your SMTP
              details plus Twilio sender numbers and run live sends from the same panel.
            </p>
          </div>

          <div className="dispatch-metrics">
            <div className="dispatch-metric">
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="dispatch-metric">
              <span>Delivered</span>
              <strong>{deliveredCount}</strong>
            </div>
            <div className="dispatch-metric">
              <span>Failed</span>
              <strong>{failedCount}</strong>
            </div>
            <div className="dispatch-metric">
              <span>Rules</span>
              <strong>{rules.length}</strong>
            </div>
          </div>
        </article>

        <section className="dispatch-grid">
          <article className="dispatch-card dispatch-card-dark">
            <div className="dispatch-heading">
              <h2>Dispatch settings</h2>
              <p>
                Twilio account credentials stay in env. This screen stores the sender numbers and
                email settings your team will use.
              </p>
            </div>

            <form action="/api/providers/save" method="post" className="dispatch-form">
              <label className="checkbox-field dispatch-check">
                <input
                  name="simulateMode"
                  type="checkbox"
                  defaultChecked={settings?.simulateMode ?? true}
                />
                <span>Run in simulate mode until all providers are confirmed</span>
              </label>

              <div className="dispatch-form-grid">
                <label className="field">
                  <span>SMTP host</span>
                  <input name="smtpHost" type="text" defaultValue={settings?.smtpHost ?? ""} />
                </label>

                <label className="field">
                  <span>From email</span>
                  <input name="smtpFrom" type="email" defaultValue={settings?.smtpFrom ?? ""} />
                </label>

                <label className="field">
                  <span>SMTP port</span>
                  <input
                    name="smtpPort"
                    type="number"
                    defaultValue={settings?.smtpPort ?? 587}
                    min={1}
                  />
                </label>

                <label className="field">
                  <span>SMTP username</span>
                  <input name="smtpUser" type="text" defaultValue={settings?.smtpUser ?? ""} />
                </label>

                <label className="field">
                  <span>SMTP password</span>
                  <input
                    name="smtpPass"
                    type="password"
                    defaultValue={settings?.smtpPass ?? ""}
                  />
                </label>

                <label className="field">
                  <span>Twilio SMS sender</span>
                  <input
                    name="smsFromNumber"
                    type="text"
                    placeholder="+14155550123"
                    defaultValue={
                      settings?.smsFromNumber || envSmsFromNumber || settings?.smsSenderId || ""
                    }
                  />
                </label>

                <label className="field">
                  <span>Twilio WhatsApp sender</span>
                  <input
                    name="whatsappFromNumber"
                    type="text"
                    placeholder="+14155238886"
                    defaultValue={settings?.whatsappFromNumber || envWhatsappFromNumber || ""}
                  />
                </label>
              </div>

              <label className="checkbox-field dispatch-check">
                <input
                  name="smtpSecure"
                  type="checkbox"
                  defaultChecked={settings?.smtpSecure ?? false}
                />
                <span>Use secure SMTP when your provider requires it</span>
              </label>

              <div className="dispatch-note">
                <p>Env fallback</p>
                <span>
                  Use <code>TWILIO_FROM_NUMBER</code> and <code>TWILIO_WHATSAPP_FROM_NUMBER</code>
                  {" "}when you want defaults without saving them per user.
                </span>
              </div>

              <button className="button" type="submit">
                Save dispatch settings
              </button>
            </form>
          </article>

          <article className="dispatch-card">
            <div className="dispatch-heading">
              <h2>Queue actions</h2>
              <p>
                Uploads only sync your data now. First generate reminders using the selected date
                and your rule day windows, then send the queued reminders when you are ready.
              </p>
            </div>

            <div className="dispatch-action-stack">
              <form action="/api/reminders/generate" method="post" className="dispatch-form">
                <label className="field">
                  <span>Generation date</span>
                  <input name="generationDate" type="date" />
                </label>
                <button className="button" type="submit">
                  Generate eligible reminders
                </button>
              </form>

              <form action="/api/reminders/send" method="post" className="dispatch-form">
                <button className="button button-secondary" type="submit">
                  Send generated reminders
                </button>
              </form>
            </div>
          </article>
        </section>

        <article className="dispatch-card">
          <div className="dispatch-heading">
            <h2>Send reminder now</h2>
            <p>
              Pick an invoice, choose a rule, and push a one-off reminder without waiting for the
              automated cycle.
            </p>
          </div>

          {dueRecords.length === 0 || rules.length === 0 ? (
            <p className="dispatch-empty">
              Upload due records and create at least one reminder rule to unlock manual sending.
            </p>
          ) : (
            <form action="/api/reminders/send" method="post" className="dispatch-form">
              <div className="dispatch-form-grid">
                <label className="field">
                  <span>Choose invoice</span>
                  <select name="dueId" defaultValue={dueRecords[0]?.id}>
                    {dueRecords.map((due) => (
                      <option key={due.id} value={due.id}>
                        {(due.invoiceNumber || due.reference || "No invoice number") +
                          " - " +
                          due.companyName +
                          " - Due " +
                          formatDate(due.dueDate)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Choose reminder</span>
                  <select name="ruleId" defaultValue={rules[0]?.id}>
                    {rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name} ({rule.daysBeforeDue} day reminder)
                        {rule.enabled ? "" : " - disabled for auto generation"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="dispatch-toggle-grid">
                <label className="checkbox-field dispatch-check">
                  <input name="channelEmail" type="checkbox" />
                  <span>Email only if checked</span>
                </label>

                <label className="checkbox-field dispatch-check">
                  <input name="channelWhatsapp" type="checkbox" />
                  <span>WhatsApp only if checked</span>
                </label>

                <label className="checkbox-field dispatch-check">
                  <input name="channelSms" type="checkbox" />
                  <span>SMS only if checked</span>
                </label>
              </div>

              <p className="dispatch-note dispatch-note-plain">
                Leave all channel boxes unchecked to use the channels already configured on the
                selected rule.
              </p>

              <button className="button" type="submit">
                Send selected reminder now
              </button>
            </form>
          )}
        </article>

        <article className="dispatch-card">
          <div className="dispatch-heading">
            <h2>Reminder queue</h2>
            <p>Showing the latest 20 reminder logs across all channels.</p>
          </div>

          <div className="table-wrap dispatch-table-wrap">
            <table className="dispatch-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Rule</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Failure reason</th>
                </tr>
              </thead>
              <tbody>
                {reminderLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Upload a dues file to populate the queue.</td>
                  </tr>
                ) : (
                  reminderLogs.map((log) => {
                    const due = dueRecordMap.get(log.dueId);
                    const rule = ruleMap.get(log.ruleId);

                    return (
                      <tr key={log.id}>
                        <td>{due?.invoiceNumber || due?.reference || due?.companyName || "N/A"}</td>
                        <td>{rule?.name || "Unknown rule"}</td>
                        <td>
                          <span className="dispatch-badge">{formatChannelLabel(log.channel)}</span>
                        </td>
                        <td>{log.recipient}</td>
                        <td>
                          <span className={`dispatch-badge dispatch-status-${log.status}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>{formatDate(log.scheduledFor)}</td>
                        <td>{log.failureReason || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}

function formatChannelLabel(channel: "email" | "whatsapp" | "sms") {
  if (channel === "whatsapp") {
    return "WhatsApp";
  }

  if (channel === "sms") {
    return "SMS";
  }

  return "Email";
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
