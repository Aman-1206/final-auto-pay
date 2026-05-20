import {
  mapDueRows,
  mapMasterRows,
  readStoredWorkbookRows,
  writeStoredWorkbookRows
} from "@/lib/excel";
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
  "Customer Code",
  "Company Name",
  "Contact Person",
  "Email",
  "WhatsApp",
  "Phone"
];

const dueManagedHeaders = [
  "Customer Code",
  "Company Name",
  "Invoice Number",
  "Invoice Date",
  "Due Date",
  "Amount",
  "Currency"
];

function buildMasterWorkbookRow(record: MasterContact) {
  return mergeRawWithCanonical(record.raw || {}, {
    "Customer Code": record.customerCode,
    "Company Name": record.companyName,
    "Contact Person": record.primaryContact,
    Email: record.email,
    WhatsApp: record.whatsapp,
    Phone: record.sms
  });
}

function buildDueWorkbookRow(record: DueRecord) {
  return mergeRawWithCanonical(record.raw || {}, {
    "Customer Code": record.customerCode,
    "Company Name": record.companyName,
    "Invoice Number": record.invoiceNumber,
    "Invoice Date": record.invoiceDate ? record.invoiceDate.slice(0, 10) : "",
    "Due Date": record.dueDate ? record.dueDate.slice(0, 10) : "",
    Amount: record.amount,
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
  const records = mapDueRows(rows, ownerId);

  if (records.length === 0) {
    throw new Error(
      "The stored due workbook no longer contains any valid rows. Please keep company name and due date values filled in."
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
