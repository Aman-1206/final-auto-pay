import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProtectedSubmitButton } from "@/components/protected-submit-button";
import { TableSearch } from "@/components/table-search";
import { filterSharedCompanyRecords, getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { findMatchingMasterContact } from "@/lib/contact-matching";
import { canDispatchReminders } from "@/lib/access-control";
import { isAdminUser, requireUser } from "@/lib/auth";
import { readDatabase } from "@/lib/storage";
import { ensureStoredDueWorkbook } from "@/lib/workbook-sync";
import { formatCurrency, formatDate, formatElapsedDaysTag } from "@/lib/utils";

export default async function DuesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);
  const workspace = getCompanyWorkspaceContextForUser(database, user);
  const dueRecords = filterSharedCompanyRecords(database.dueRecords, workspace.sharedOwnerIds)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const masterContacts = filterSharedCompanyRecords(database.masterContacts, workspace.sharedOwnerIds);
  const sendableDueRecords = dueRecords.filter((entry) =>
    Boolean(findMatchingMasterContact(entry, masterContacts))
  );
  const rules = database.reminderRules
    .filter((entry) => entry.ownerId === workspace.configOwnerId)
    .sort((left, right) => left.triggerDay - right.triggerDay);
  const reminderLogs = filterSharedCompanyRecords(database.reminderLogs, workspace.sharedOwnerIds)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const canDispatch = canDispatchReminders(user);

  if (dueRecords.length > 0) {
    await ensureStoredDueWorkbook(workspace.workspaceId, user.companyName);
  }

  return (
    <DashboardShell
      title="Dues upload workspace"
      description="Upload your latest dues sheet once for the whole company, keep it in sync with master contacts, then choose when to generate and send reminders."
      companyName={user.companyName}
      userName={user.name}
      isAdmin={isAdminUser(user)}
      userRole={user.role}
      canSendManualReminders={user.canSendManualReminders}
    >
      <StatusBar params={params} />

      <section className="content-grid">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Upload dues Excel</h2>
            <p>
              Recommended headers for your latest sheet: Date, Ref. No., Party&apos;s Name,
              Opening Amount, Pending Amount, Due on, and Overdue by days. Dealer code is now
              optional in dues imports, so party names can still be matched with the master
              database when the code is missing. This upload is shared across all users and admins
              in your company workspace.
            </p>
          </div>

          <form
            action="/api/dues/upload"
            method="post"
            encType="multipart/form-data"
            className="form-stack"
          >
            <label className="field">
              <span>Upload file</span>
              <input name="file" type="file" accept=".xlsx,.xlxs,.xls,.csv" required />
            </label>

            <label className="field">
              <span>Due database upload password</span>
              <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
            </label>

            <label className="field">
              <span>Import mode</span>
              <select name="mode" defaultValue="replace">
                <option value="replace">Replace existing dues records</option>
                <option value="append">Append to existing dues records</option>
              </select>
            </label>

            <div className="button-row">
              <ProtectedSubmitButton className="button">
                Save dues data
              </ProtectedSubmitButton>
              <a className="button button-secondary" href="/api/dues/sample">
                Download sample Excel
              </a>
            </div>
          </form>

          {dueRecords.length > 0 ? (
            <form action="/api/dues/delete" method="post" className="compact-form">
              <ConfirmSubmitButton
                className="button button-danger"
                confirmationMessage="Delete the current shared due workbook and all synced due records for this company workspace?"
              >
                Delete current due file
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Dispatch from dues</h2>
            <p>
              Select invoice rows, choose reminder channels, and dispatch immediately without
              leaving this page.
            </p>
          </div>

          {dueRecords.length === 0 ? (
            <p className="muted-copy">
              Upload a due file first. Review, select, and dispatch controls appear here once
              records are available.
            </p>
          ) : !canDispatch ? (
            <p className="muted-copy">
              Your user role is view-only for dispatch. A Super Admin can grant manual reminder
              permission from User Management.
            </p>
          ) : (
            <div className="stacked-layout">
              <form action="/api/reminders/generate" method="post" className="dispatch-form">
                <label className="field">
                  <span>Generation date</span>
                  <input name="generationDate" type="date" />
                </label>
                <label className="field">
                  <span>Dispatch password</span>
                  <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
                </label>
                <ProtectedSubmitButton className="button button-secondary">
                  Generate eligible reminders
                </ProtectedSubmitButton>
              </form>

              <form action="/api/reminders/send" method="post" className="dispatch-form">
                <label className="field">
                  <span>Dispatch password</span>
                  <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
                </label>
                <ProtectedSubmitButton
                  className="button"
                  confirmationMessage="Send every pending reminder currently in the queue?"
                >
                  Send generated queue
                </ProtectedSubmitButton>
              </form>
            </div>
          )}
        </article>

        <article className="glass-panel rule-span">
          <div className="section-heading">
            <h2>Review dues and dispatch selected records</h2>
            <p>
              {dueRecords.length} shared records active. Select single invoices, multiple
              invoices, entire dealers, multiple dealers, or entire companies by checking the
              matching rows below.
            </p>
          </div>

          <TableSearch />

          {canDispatch && sendableDueRecords.length > 0 && rules.length > 0 ? (
            <form action="/api/reminders/send" method="post" className="dispatch-form">
              <input type="hidden" name="bulkSelection" value="selected" />
              <div className="dispatch-form-grid">
                <label className="field">
                  <span>Reminder rule</span>
                  <select name="ruleId" defaultValue={rules[0]?.id}>
                    {rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name} (day {rule.triggerDay})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Dispatch password</span>
                  <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
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

              <p className="muted-copy">
                Leave all channel boxes unchecked to use the channels already configured on the
                selected rule. Use the search field to narrow a dealer, company, or invoice, then
                check the visible matching rows.
              </p>

          <div className="table-wrap">
            <table data-searchable-table>
              <thead>
                <tr>
                      <th>Select</th>
                  <th>No.</th>
                      <th>Dealer code</th>
                  <th>Company</th>
                  <th>Invoice</th>
                  <th>Bill age</th>
                  <th>Overdue</th>
                  <th>Contact match</th>
                      <th>Salesperson</th>
                  <th>Due date</th>
                  <th>Pending</th>
                      <th>Total due</th>
                </tr>
              </thead>
              <tbody>
                {dueRecords.length === 0 ? (
                  <tr>
                        <td colSpan={12}>Upload a dues file to preview the active records.</td>
                  </tr>
                ) : (
                      dueRecords.map((due, index) => (
                    <tr key={due.id}>
                          <td>
                            <input
                              name="dueIds"
                              type="checkbox"
                              value={due.id}
                              disabled={!findMatchingMasterContact(due, masterContacts)}
                            />
                          </td>
                      <td>{index + 1}</td>
                          <td>{due.dealerCode || due.customerCode || "N/A"}</td>
                      <td>{due.companyName}</td>
                      <td>{due.invoiceNumber || due.reference || "N/A"}</td>
                      <td>{formatElapsedDaysTag(due.billDate || due.invoiceDate)}</td>
                      <td>{due.overdueDays > 0 ? `${due.overdueDays} days` : "Current"}</td>
                      <td>{due.contactMatchStatus === "matched" ? "Matched" : "Missing"}</td>
                          <td>{due.salespersonName || due.salespersonEmail || "Unassigned"}</td>
                      <td>{formatDate(due.dueDate)}</td>
                      <td>{formatCurrency(due.amount, due.currency)}</td>
                          <td>{formatCurrency(due.totalDueAmount || due.amount, due.currency)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

              <ProtectedSubmitButton
                className="button"
                confirmationMessage="Send reminders for every selected due record?"
              >
                Send selected reminders
              </ProtectedSubmitButton>
            </form>
          ) : (
            <div className="table-wrap">
              <table data-searchable-table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Dealer code</th>
                    <th>Company</th>
                    <th>Invoice</th>
                    <th>Salesperson</th>
                    <th>Contact match</th>
                    <th>Pending</th>
                    <th>Total due</th>
                  </tr>
                </thead>
                <tbody>
                  {dueRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8}>Upload a dues file to preview the active records.</td>
                    </tr>
                  ) : (
                    dueRecords.map((due, index) => (
                      <tr key={due.id}>
                        <td>{index + 1}</td>
                        <td>{due.dealerCode || due.customerCode || "N/A"}</td>
                        <td>{due.companyName}</td>
                        <td>{due.invoiceNumber || due.reference || "N/A"}</td>
                        <td>{due.salespersonName || due.salespersonEmail || "Unassigned"}</td>
                        <td>{due.contactMatchStatus === "matched" ? "Matched" : "Missing"}</td>
                        <td>{formatCurrency(due.amount, due.currency)}</td>
                        <td>{formatCurrency(due.totalDueAmount || due.amount, due.currency)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="glass-panel rule-span">
          <div className="section-heading">
            <h2>Reminder queue</h2>
            <p>Latest generated, sent, simulated, and failed reminder records.</p>
          </div>

          <TableSearch label="Search reminder queue" />
          <div className="table-wrap">
            <table data-searchable-table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Invoice</th>
                  <th>Dealer</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Failure</th>
                </tr>
              </thead>
              <tbody>
                {reminderLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No reminders have been generated yet.</td>
                  </tr>
                ) : (
                  reminderLogs.slice(0, 100).map((log, index) => (
                    <tr key={log.id}>
                      <td>{index + 1}</td>
                      <td>{log.invoiceNumber || "N/A"}</td>
                      <td>{log.dealerCode || "N/A"}</td>
                      <td className="capitalize">{log.channel}</td>
                      <td>{log.recipient || "N/A"}</td>
                      <td className="capitalize">{log.status}</td>
                      <td>{formatDate(log.scheduledFor)}</td>
                      <td>{log.failureReason || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="glass-panel rule-span">
          <div className="section-heading">
            <h2>Edit outside the app</h2>
            <p>
              The row-by-row workbook editor has been removed. Download the current dues file,
              edit it in Excel or Google Sheets, then upload it back here.
            </p>
          </div>

          {dueRecords.length === 0 ? (
            <p className="muted-copy">
              Upload a due file first, then you can download it, edit it outside the app, and
              re-upload the updated version.
            </p>
          ) : (
            <div className="stacked-layout">
              <p className="muted-copy">
                If you prefer browser editing, import the downloaded dues file into Google Sheets,
                update it there, then export it back as `.xlsx` or `.csv` before uploading it here
                again.
              </p>

              <div className="button-row">
                <a className="button button-secondary" href="/api/dues/download">
                  Download current dues file
                </a>

                <form action="/api/dues/refresh" method="post">
                  <button className="button button-secondary" type="submit">
                    Refresh from stored file
                  </button>
                </form>
              </div>

              <p className="muted-copy">
                Use `Replace existing dues records` when re-uploading your edited file so the
                latest sheet fully replaces the active due list before you generate reminders.
              </p>
            </div>
          )}
        </article>
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
