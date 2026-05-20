import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/reminder-engine";
import { readDatabase } from "@/lib/storage";
import { formatCurrency, formatDate, formatElapsedDaysTag } from "@/lib/utils";

export default async function DashboardOverview({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [stats, database, params] = await Promise.all([
    getDashboardStats(user.id),
    readDatabase(),
    searchParams
  ]);

  const dueRecords = database.dueRecords
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 5);
  const reminderLogs = database.reminderLogs
    .filter((entry) => entry.ownerId === user.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 6);

  return (
    <DashboardShell
      title="Reminder command center"
      description="Track your imported records, check upcoming dues, and see the latest reminder activity."
      companyName={user.companyName}
      userName={user.name}
    >
      <StatusBar params={params} />

      <section className="stats-grid">
        <article className="stat-card glass-panel">
          <span className="stat-label">Master Contacts</span>
          <strong>{stats.masterCount}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Due Records</span>
          <strong>{stats.dueCount}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Pending Reminders</span>
          <strong>{stats.pendingReminders}</strong>
        </article>
        <article className="stat-card glass-panel">
          <span className="stat-label">Sent or Simulated</span>
          <strong>{stats.sentReminders}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="glass-panel">
          <div className="section-heading">
            <h2>Upcoming dues</h2>
            <p>Generate reminders from these due dates whenever you are ready to build the queue.</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
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
                    <td colSpan={5}>No due records uploaded yet.</td>
                  </tr>
                ) : (
                  dueRecords.map((due) => (
                    <tr key={due.id}>
                      <td>{due.companyName}</td>
                      <td>{due.invoiceNumber || due.reference || "N/A"}</td>
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

        <article className="glass-panel">
          <div className="section-heading">
            <h2>Latest reminder activity</h2>
            <p>Preview what has been generated or sent.</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {reminderLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No reminder activity yet.</td>
                  </tr>
                ) : (
                  reminderLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="capitalize">{log.channel}</td>
                      <td>{log.recipient}</td>
                      <td className="capitalize">{log.status}</td>
                      <td>{formatDate(log.scheduledFor)}</td>
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

  if (!message && !error) {
    return null;
  }

  return (
    <p className={`status-banner ${error ? "status-error" : "status-success"}`}>
      {decodeURIComponent(error || message)}
    </p>
  );
}
