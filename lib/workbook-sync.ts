import {
  mapDueRows,
  mapMasterRows,
  readStoredWorkbookRows,
  writeStoredWorkbookRows
} from "@/lib/excel";
import { buildDueContactMatch } from "@/lib/contact-matching";
import { readDatabase, updateDatabase } from "@/lib/storage";
import type { DueRecord, MasterContact } from "@/lib/types";

function normalizeWorkbookHeader(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ");
}

function mergeRawWithCanonical(
  raw: Record<string, string>,
  canonical: Record<string, string | number>
) {
  const protectedHeaders = new Set(Object.keys(canonical).map(normalizeWorkbookHeader));
  const preservedRawEntries = Object.entries(raw || {}).filter(
    ([key]) => !protectedHeaders.has(normalizeWorkbookHeader(key))
  );

  return {
    ...Object.fromEntries(preservedRawEntries),
    ...canonical
  };
}

function rowHasManagedHeaderDuplicates(
  row: Record<string, unknown>,
  managedHeaders: string[]
) {
  const managedSet = new Set(managedHeaders.map(normalizeWorkbookHeader));
  const counts = new Map<string, number>();

  Object.keys(row).forEach((key) => {
    const normalized = normalizeWorkbookHeader(key);
    if (!managedSet.has(normalized)) {
      return;
    }

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });

  return Array.from(counts.values()).some((count) => count > 1);
}

const masterManagedHeaders = [
  "Dealer Code",
  "Company Name",
  "Contact Person",
  "Email",
  "WhatsApp",
  "Phone"
];

const dueManagedHeaders = [
  "Date",
  "Ref. No.",
  "Party's Name",
  "Opening Amount",
  "Pending Amount",
  "Due on",
  "Overdue by days",
  "Dealer Code",
  "Currency"
];

function buildMasterWorkbookRow(record: MasterContact) {
  return mergeRawWithCanonical(record.raw || {}, {
    "Dealer Code": record.dealerCode || record.customerCode,
    "Company Name": record.companyName,
    "Contact Person": record.primaryContact,
    Email: record.email,
    WhatsApp: record.whatsapp,
    Phone: record.sms
  });
}

function buildDueWorkbookRow(record: DueRecord) {
  return mergeRawWithCanonical(record.raw || {}, {
    Date: (record.billDate || record.invoiceDate) ? (record.billDate || record.invoiceDate).slice(0, 10) : "",
    "Ref. No.": record.invoiceNumber || record.reference,
    "Party's Name": record.companyName,
    "Opening Amount": record.openingAmount,
    "Pending Amount": record.amount,
    "Due on": record.dueDate ? record.dueDate.slice(0, 10) : "",
    "Overdue by days": record.overdueDays,
    "Dealer Code": record.dealerCode || record.customerCode,
    Currency: record.currency
  });
}

export async function ensureStoredMasterWorkbook(ownerId: string) {
  try {
    const { rows } = await readStoredWorkbookRows(ownerId, "master");
    const hasDuplicateManagedHeaders = rows.some((row) =>
      rowHasManagedHeaderDuplicates(row, masterManagedHeaders)
    );

    if (!hasDuplicateManagedHeaders) {
      return { restored: false, rowCount: rows.length };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("No stored master workbook")) {
      throw error;
    }
  }

  const database = await readDatabase();
  const records = database.masterContacts.filter((entry) => entry.ownerId === ownerId);

  if (records.length === 0) {
    return { restored: false, rowCount: 0 };
  }

  const rows = records.map(buildMasterWorkbookRow);
  await writeStoredWorkbookRows(ownerId, "master", rows);

  return { restored: true, rowCount: rows.length };
}

export async function ensureStoredDueWorkbook(ownerId: string) {
  try {
    const { rows } = await readStoredWorkbookRows(ownerId, "due");
    const hasDuplicateManagedHeaders = rows.some((row) =>
      rowHasManagedHeaderDuplicates(row, dueManagedHeaders)
    );

    if (!hasDuplicateManagedHeaders) {
      return { restored: false, rowCount: rows.length };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("No stored due workbook")) {
      throw error;
    }
  }

  const database = await readDatabase();
  const records = database.dueRecords.filter((entry) => entry.ownerId === ownerId);

  if (records.length === 0) {
    return { restored: false, rowCount: 0 };
  }

  const rows = records.map(buildDueWorkbookRow);
  await writeStoredWorkbookRows(ownerId, "due", rows);

  return { restored: true, rowCount: rows.length };
}

export async function syncStoredMasterWorkbook(ownerId: string) {
  const { rows } = await readStoredWorkbookRows(ownerId, "master");
  const records = mapMasterRows(rows, ownerId);

  if (records.length === 0) {
    throw new Error(
      "The stored master workbook no longer contains any valid rows. Please keep at least one company name row."
    );
  }

  await updateDatabase((database) => {
    database.masterContacts = database.masterContacts.filter((entry) => entry.ownerId !== ownerId);
    database.masterContacts.push(...records);
    database.dueRecords = database.dueRecords.map((entry) => {
      if (entry.ownerId !== ownerId) {
        return entry;
      }

      const match = buildDueContactMatch(entry, records);
      return {
        ...entry,
        companyName: match.companyName,
        matchedContactId: match.matchedContactId,
        matchedContactName: match.matchedContactName,
        matchedEmail: match.matchedEmail,
        matchedWhatsapp: match.matchedWhatsapp,
        matchedSms: match.matchedSms,
        contactMatchStatus: match.contactMatchStatus
      };
    });
    database.reminderLogs = database.reminderLogs.filter(
      (entry) =>
        !(
          entry.ownerId === ownerId &&
          (entry.status === "pending" || entry.status === "failed")
        )
    );
  });

  return {
    recordCount: records.length
  };
}

export async function syncStoredDueWorkbook(ownerId: string) {
  const { rows } = await readStoredWorkbookRows(ownerId, "due");
  const database = await readDatabase();
  const contacts = database.masterContacts.filter((entry) => entry.ownerId === ownerId);
  const records = mapDueRows(rows, ownerId, contacts);

  if (records.length === 0) {
    throw new Error(
      "The stored due workbook no longer contains any valid rows. Please keep bill date filled in with either dealer code or party name."
    );
  }

  await updateDatabase((database) => {
    database.dueRecords = database.dueRecords.filter((entry) => entry.ownerId !== ownerId);
    database.dueRecords.push(...records);
    database.reminderLogs = database.reminderLogs.filter(
      (entry) =>
        !(
          entry.ownerId === ownerId &&
          (entry.status === "pending" || entry.status === "failed")
        )
    );
  });

  return {
    recordCount: records.length
  };
}
