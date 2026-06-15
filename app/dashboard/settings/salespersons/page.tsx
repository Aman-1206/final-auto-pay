import { DashboardShell } from "@/components/dashboard-shell";
import { ProtectedSubmitButton } from "@/components/protected-submit-button";
import { TableSearch } from "@/components/table-search";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { readDatabase } from "@/lib/storage";

export default async function SalespersonPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);
  const workspace = getCompanyWorkspaceContextForUser(database, user);
  const salespersons = database.salespersons.filter((entry) => entry.ownerId === workspace.configOwnerId);

  return (
    <DashboardShell
      title="Salesperson configuration"
      description="Manage salesperson profiles and dealer-code mappings."
      companyName={user.companyName}
      userName={user.name}
      isAdmin
      userRole={user.role}
      canSendManualReminders={user.canSendManualReminders}
    >
      <StatusBar params={params} />

      <section className="content-grid">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Upload salesperson file</h2>
            <p>
              Import salesperson name, email, and assigned dealer codes. Use the sample file to
              test reports with all emails routed to amankumarschool7@gmail.com.
            </p>
          </div>
          <form
            action="/api/salespersons/upload"
            method="post"
            encType="multipart/form-data"
            className="form-stack"
          >
            <label className="field">
              <span>Upload file</span>
              <input name="file" type="file" accept=".xlsx,.xls,.csv" required />
            </label>
            <label className="field">
              <span>Import mode</span>
              <select name="mode" defaultValue="replace">
                <option value="replace">Replace current salesperson mappings</option>
                <option value="append">Append or update matching salespersons</option>
              </select>
            </label>
            <label className="field">
              <span>Admin settings password</span>
              <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
            </label>
            <div className="button-row">
              <ProtectedSubmitButton className="button">
                Upload salesperson file
              </ProtectedSubmitButton>
              <a className="button button-secondary" href="/api/salespersons/sample">
                Download sample Excel
              </a>
            </div>
          </form>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Add salesperson</h2>
            <p>Dealer codes can be entered one per line or comma-separated.</p>
          </div>
          <form action="/api/salespersons/save" method="post" className="form-stack">
            <input type="hidden" name="salespersonId" value="" />
            <label className="field">
              <span>Salesperson name</span>
              <input name="name" required />
            </label>
            <label className="field">
              <span>Employee ID</span>
              <input name="employeeId" required />
            </label>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" required />
            </label>
            <label className="field">
              <span>Phone number</span>
              <input name="phoneNumber" />
            </label>
            <label className="field">
              <span>Dealer codes</span>
              <textarea name="dealerCodes" rows={6} />
            </label>
            <label className="field">
              <span>Admin settings password</span>
              <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
            </label>
            <ProtectedSubmitButton className="button">
              Save salesperson
            </ProtectedSubmitButton>
          </form>
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Current mappings</h2>
            <p>{salespersons.length} salesperson profiles configured.</p>
          </div>
          <TableSearch />
          <div className="table-wrap">
            <table data-searchable-table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Dealers</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {salespersons.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No salespersons configured.</td>
                  </tr>
                ) : (
                  salespersons.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.name}</td>
                      <td>{entry.employeeId}</td>
                      <td>{entry.email}</td>
                      <td>{entry.phoneNumber || "-"}</td>
                      <td>{entry.dealerCodes.join(", ") || "-"}</td>
                      <td>
                        <div className="table-action-stack">
                          <details>
                            <summary className="button button-secondary">Edit</summary>
                            <form action="/api/salespersons/save" method="post" className="form-stack inline-edit-form">
                              <input type="hidden" name="salespersonId" value={entry.id} />
                              <label className="field">
                                <span>Salesperson name</span>
                                <input name="name" defaultValue={entry.name} required />
                              </label>
                              <label className="field">
                                <span>Employee ID</span>
                                <input name="employeeId" defaultValue={entry.employeeId} required />
                              </label>
                              <label className="field">
                                <span>Email</span>
                                <input name="email" type="email" defaultValue={entry.email} required />
                              </label>
                              <label className="field">
                                <span>Phone number</span>
                                <input name="phoneNumber" defaultValue={entry.phoneNumber} />
                              </label>
                              <label className="field">
                                <span>Dealer codes</span>
                                <textarea name="dealerCodes" rows={5} defaultValue={entry.dealerCodes.join("\n")} />
                              </label>
                              <label className="field">
                                <span>Admin settings password</span>
                                <input name="operationPassword" type="password" minLength={8} placeholder="At least 8 characters" />
                              </label>
                              <ProtectedSubmitButton className="button">
                                Update salesperson
                              </ProtectedSubmitButton>
                            </form>
                          </details>

                          <form action="/api/salespersons/delete" method="post" className="form-stack">
                            <input type="hidden" name="salespersonId" value={entry.id} />
                            <input name="operationPassword" type="password" minLength={8} placeholder="Admin password" />
                            <ProtectedSubmitButton
                              className="button button-ghost"
                              confirmationMessage={`Delete salesperson ${entry.name}?`}
                            >
                              Delete
                            </ProtectedSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </DashboardShell>
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
