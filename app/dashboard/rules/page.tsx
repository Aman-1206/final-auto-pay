import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { readDatabase } from "@/lib/storage";

export default async function RulesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);

  const rules = database.reminderRules
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => right.daysBeforeDue - left.daysBeforeDue);
  const templates = database.templates.filter((entry) => entry.ownerId === user.id);

  return (
    <DashboardShell
      title="Reminder rules and templates"
      description="Choose how many days before due date you want to notify clients and edit every message template."
      companyName={user.companyName}
      userName={user.name}
    >
      <StatusBar params={params} />

      <section className="stacked-layout">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Create a new reminder rule</h2>
            <p>Add any timing you need such as 15, 30, 45, 60, or 90 days before due date.</p>
          </div>

          <form action="/api/rules/save" method="post" className="rule-grid">
            <input type="hidden" name="ruleId" value="" />
            <input type="hidden" name="templateId" value="" />

            <label className="field">
              <span>Rule name</span>
              <input name="name" type="text" placeholder="15 Day Reminder" required />
            </label>

            <label className="field">
              <span>Days before due</span>
              <input name="daysBeforeDue" type="number" min={1} placeholder="15" required />
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
                placeholder="Payment reminder: invoice {{invoiceNumber}} due on {{dueDate}}"
                required
              />
            </label>

            <label className="field rule-span">
              <span>Email body</span>
              <textarea
                name="emailBody"
                rows={7}
                defaultValue={`Dear {{contactName}},

This is a reminder that invoice {{invoiceNumber}} for {{companyName}} amounting to {{amount}} is due on {{dueDate}}.

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
                defaultValue="Hello {{contactName}}, invoice {{invoiceNumber}} for {{companyName}} worth {{amount}} is due on {{dueDate}}."
                required
              />
            </label>

            <label className="field">
              <span>SMS template</span>
              <textarea
                name="smsBody"
                rows={5}
                defaultValue="Reminder: invoice {{invoiceNumber}} for {{companyName}} amount {{amount}} is due on {{dueDate}}."
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
                <p>{rule.daysBeforeDue} days before due date</p>
              </div>

              <form action="/api/rules/save" method="post" className="rule-grid">
                <input type="hidden" name="ruleId" value={rule.id} />
                <input type="hidden" name="templateId" value={template.id} />

                <label className="field">
                  <span>Rule name</span>
                  <input name="name" type="text" defaultValue={rule.name} required />
                </label>

                <label className="field">
                  <span>Days before due</span>
                  <input
                    name="daysBeforeDue"
                    type="number"
                    min={1}
                    defaultValue={rule.daysBeforeDue}
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
                  <textarea name="emailBody" rows={7} defaultValue={template.emailBody} required />
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
                  <textarea name="smsBody" rows={5} defaultValue={template.smsBody} required />
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
