import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { readDatabase } from "@/lib/storage";
import { ensureStoredMasterWorkbook } from "@/lib/workbook-sync";
import { formatDate } from "@/lib/utils";

export default async function MasterDatabasePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [database, params] = await Promise.all([readDatabase(), searchParams]);
  const contacts = database.masterContacts.filter((entry) => entry.ownerId === user.id);

  if (contacts.length > 0) {
    await ensureStoredMasterWorkbook(user.id);
  }

  return (
    <DashboardShell
      title="Master contact database"
      description="Upload your long-lived company contact sheet and keep payment contacts ready for matching."
      companyName={user.companyName}
      userName={user.name}
    >
      <StatusBar params={params} />

      <section className="content-grid">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Upload master Excel</h2>
            <p>
              Recommended headers: Customer Code, Company Name, Contact Person, Email, WhatsApp,
              Phone.
            </p>
          </div>

          <form
            action="/api/master/upload"
            method="post"
            encType="multipart/form-data"
            className="form-stack"
          >
            <label className="field">
              <span>Upload file</span>
              <input name="file" type="file" accept=".xlsx,.xlxs,.xls,.csv" required />
            </label>

            <label className="field">
              <span>Import mode</span>
              <select name="mode" defaultValue="replace">
                <option value="replace">Replace existing master records</option>
                <option value="append">Append to existing master records</option>
              </select>
            </label>

            <button className="button" type="submit">
              Save master database
            </button>
          </form>

          {contacts.length > 0 ? (
            <form action="/api/master/delete" method="post" className="compact-form">
              <ConfirmSubmitButton
                className="button button-danger"
                confirmationMessage="Delete the current master workbook and all synced contact records for this workspace?"
              >
                Delete current master file
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Current contacts</h2>
            <p>{contacts.length} records available for reminder matching.</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer code</th>
                  <th>Company</th>
                  <th>Primary contact</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Upload a master file to populate contacts.</td>
                  </tr>
                ) : (
                  contacts.slice(0, 20).map((contact) => (
                    <tr key={contact.id}>
                      <td>{contact.customerCode || "N/A"}</td>
                      <td>{contact.companyName}</td>
                      <td>{contact.primaryContact || "N/A"}</td>
                      <td>{contact.email || "N/A"}</td>
                      <td>{contact.whatsapp || contact.sms || "N/A"}</td>
                      <td>{formatDate(contact.importedAt)}</td>
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
              The row-by-row workbook editor has been removed. Download the current file, edit it
              in Excel or Google Sheets, then upload it back here when you are ready.
            </p>
          </div>

          {contacts.length === 0 ? (
            <p className="muted-copy">
              Upload a master file first, then you can download it, edit it outside the app, and
              re-upload the updated version.
            </p>
          ) : (
            <div className="stacked-layout">
              <p className="muted-copy">
                If you want browser editing, import the downloaded file into Google Sheets, make
                your changes there, then export it again as `.xlsx` or `.csv` and upload it here
                using replace mode.
              </p>

              <div className="button-row">
                <a className="button button-secondary" href="/api/master/download">
                  Download current master file
                </a>

                <form action="/api/master/refresh" method="post">
                  <button className="button button-secondary" type="submit">
                    Refresh from stored file
                  </button>
                </form>
              </div>

              <p className="muted-copy">
                Use `Replace existing master records` when re-uploading your edited file so the app
                fully re-syncs the latest version.
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
