import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
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
  const dueRecords = database.dueRecords.filter((entry) => entry.ownerId === user.id);

  if (dueRecords.length > 0) {
    await ensureStoredDueWorkbook(user.id);
  }

  return (
    <DashboardShell
      title="Dues upload workspace"
      description="Upload your latest dues sheet, keep it in sync with master contacts, then choose when to generate and send reminders."
    >
      <StatusBar params={params} />

      <section className="content-grid">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Upload dues Excel</h2>
            <p>
              Recommended headers: Customer Code, Company Name, Invoice Number, Invoice Date, Due
              Date, Amount, Currency. Uploading updates the data only. Reminders are generated
              later when you choose.
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
              <span>Import mode</span>
              <select name="mode" defaultValue="replace">
                <option value="replace">Replace existing dues records</option>
                <option value="append">Append to existing dues records</option>
              </select>
            </label>

            <button className="button" type="submit">
              Save dues data
            </button>
          </form>

          {dueRecords.length > 0 ? (
            <form action="/api/dues/delete" method="post" className="compact-form">
              <ConfirmSubmitButton
                className="button button-danger"
                confirmationMessage="Delete the current due workbook and all synced due records for this workspace?"
              >
                Delete current due file
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Next step after upload</h2>
            <p>
              Generate reminders only for invoices that match your rule windows, then send the
              queue after you review it.
            </p>
          </div>

          {dueRecords.length === 0 ? (
            <p className="muted-copy">
              Upload a due file first. After that you can generate eligible reminders and send them
              from the dispatch center.
            </p>
          ) : (
            <div className="stacked-layout">
              <p className="muted-copy">
                Step 1: generate reminders for today or for any date you want to test. Step 2:
                send the generated queue only after review.
              </p>

              <div className="button-row">
                <a className="button" href="/dashboard/dispatch">
                  Open dispatch center
                </a>
              </div>
            </div>
          )}
        </article>

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Latest dues preview</h2>
            <p>{dueRecords.length} records currently active in the dues list.</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer code</th>
                  <th>Company</th>
                  <th>Invoice</th>
                  <th>Bill age</th>
                  <th>Due date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dueRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Upload a dues file to preview the active records.</td>
                  </tr>
                ) : (
                  dueRecords.slice(0, 20).map((due) => (
                    <tr key={due.id}>
                      <td>{due.customerCode || "N/A"}</td>
                      <td>{due.companyName}</td>
                      <td>{due.invoiceNumber || "N/A"}</td>
                      <td>{formatElapsedDaysTag(due.invoiceDate)}</td>
                      <td>{formatDate(due.dueDate)}</td>
                      <td>{formatCurrency(due.amount, due.currency)}</td>
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
