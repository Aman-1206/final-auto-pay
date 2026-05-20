import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import type { DueRecord, MasterContact } from "@/lib/types";

type RawRow = Record<string, string | number | boolean | Date | undefined>;
type ImportKind = "master" | "due";
type WorkbookUpdateHandler = (rows: RawRow[]) => RawRow[] | Promise<RawRow[]>;

type MasterRowLookup = {
  customerCode: string;
  companyName?: string;
  primaryContact?: string;
};

type MasterRowChanges = {
  customerCode: string;
  companyName: string;
  primaryContact: string;
  email: string;
  whatsapp: string;
  sms: string;
  alternateContact: string;
  notes: string;
};

type DueRowLookup = {
  customerCode: string;
  companyName?: string;
  invoiceNumber?: string;
  dueDate?: string;
};

type DueRowChanges = {
  customerCode: string;
  companyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  currency: string;
  reference: string;
  notes: string;
};

const storedWorkbookFileNames: Record<ImportKind, string> = {
  master: "master-database.xlsx",
  due: "due-database.xlsx"
};

const masterFieldCandidates = {
  customerCode: ["customer code", "customer id", "customer number", "code", "party code"],
  companyName: [
    "company name",
    "company",
    "client name",
    "customer name",
    "party name",
    "name of company",
    "particulars",
    "particular"
  ],
  primaryContact: [
    "contact person",
    "primary contact",
    "contact name",
    "person",
    "contact person name",
    "contact"
  ],
  email: ["email", "email id", "mail", "email address"],
  whatsapp: [
    "whatsapp",
    "whatsapp number",
    "wa number",
    "whatsapp no",
    "whatsapp no.",
    "whatsapp mobile"
  ],
  sms: [
    "sms",
    "phone",
    "phone number",
    "phone no",
    "phone no.",
    "mobile",
    "mobile number",
    "mobile no",
    "mobile no.",
    "contact number",
    "contact no"
  ],
  alternateContact: ["alternate contact", "secondary contact", "alt contact", "alternate number"],
  notes: ["notes", "remarks", "comment"]
} as const;

const dueFieldCandidates = {
  customerCode: ["customer code", "customer id", "customer number", "code", "party code"],
  companyName: [
    "company name",
    "company",
    "client name",
    "customer name",
    "party name",
    "name of company",
    "particulars",
    "particular"
  ],
  invoiceNumber: [
    "invoice no",
    "invoice no.",
    "invoice number",
    "bill no",
    "bill no.",
    "reference no",
    "reference no.",
    "invoice"
  ],
  invoiceDate: ["invoice date", "invoice dt", "bill date", "bill dt"],
  dueDate: ["due date", "payment due date", "reminder date", "due dt", "due on"],
  amount: [
    "amount",
    "invoice amount",
    "due amount",
    "balance amount",
    "outstanding",
    "outstanding amount",
    "pending amount"
  ],
  currency: ["currency"],
  reference: ["reference", "reference number", "po number", "po no"],
  notes: ["notes", "remarks", "comment"]
} as const;

function normalizeHeader(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ");
}

function getCandidateHeaders(kind: ImportKind) {
  const fieldCandidates = kind === "master" ? masterFieldCandidates : dueFieldCandidates;
  return new Set(
    Object.values(fieldCandidates)
      .flat()
      .map((value) => normalizeHeader(value))
  );
}

function toText(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function excelSerialToIsoDate(value: number) {
  const wholeDays = Math.floor(value);
  const fractionalDay = value - wholeDays;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const parsed = new Date(
    excelEpoch + wholeDays * 24 * 60 * 60 * 1000 + Math.round(fractionalDay * 24 * 60 * 60 * 1000)
  );

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function toDateValue(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "number") {
    return excelSerialToIsoDate(value);
  }

  const text = toText(value);
  const normalized = text.replace(/[.\-]/g, "/");
  const dayFirstMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const year = Number(
      dayFirstMatch[3].length === 2 ? `20${dayFirstMatch[3]}` : dayFirstMatch[3]
    );
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return parsed.toISOString();
    }
  }

  const direct = new Date(text);
  return Number.isNaN(direct.getTime()) ? "" : direct.toISOString();
}

function toDateComparisonKey(value: unknown) {
  const normalizedDate = toDateValue(value);
  return normalizedDate ? normalizedDate.slice(0, 10) : "";
}

function toAmount(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const text = toText(value).replace(/,/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCellValue(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }

  const text = String(value).trim();
  if (text === "") {
    return "";
  }

  const numeric = Number(text.replace(/,/g, ""));
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(text.replace(/,/g, ""))
    ? numeric
    : text;
}

function normalizeRow(row: RawRow) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  );
}

function pickValue(row: Record<string, unknown>, candidates: readonly string[]) {
  for (const candidate of candidates) {
    const value = row[normalizeHeader(candidate)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function getExistingRowKey(row: RawRow, candidates: readonly string[]) {
  const candidateSet = new Set(candidates.map((candidate) => normalizeHeader(candidate)));

  return Object.keys(row).find((key) => candidateSet.has(normalizeHeader(key)));
}

function setRowField(
  row: RawRow,
  candidates: readonly string[],
  fallbackHeader: string,
  value: unknown
) {
  const nextRow = { ...row };
  const key = getExistingRowKey(nextRow, candidates) || fallbackHeader;
  nextRow[key] = toCellValue(value);
  return nextRow;
}

function matchesTextField(row: RawRow, candidates: readonly string[], expected: string) {
  if (!expected.trim()) {
    return true;
  }

  return normalizeHeader(toText(pickValue(row, candidates))) === normalizeHeader(expected);
}

function matchesDateField(row: RawRow, candidates: readonly string[], expected: string) {
  if (!expected.trim()) {
    return true;
  }

  return toDateComparisonKey(pickValue(row, candidates)) === toDateComparisonKey(expected);
}

function findUniqueRowIndex(
  rows: RawRow[],
  matcher: (row: RawRow) => boolean
) {
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => matcher(row));

  return matches.length === 1 ? matches[0].index : -1;
}

function findMasterRowIndex(rows: RawRow[], lookup: MasterRowLookup) {
  const codeIndex = rows.findIndex((row) =>
    matchesTextField(row, masterFieldCandidates.customerCode, lookup.customerCode)
  );

  if (codeIndex !== -1) {
    return codeIndex;
  }

  const exactIndex = rows.findIndex(
    (row) =>
      matchesTextField(row, masterFieldCandidates.companyName, lookup.companyName || "") &&
      matchesTextField(row, masterFieldCandidates.primaryContact, lookup.primaryContact || "")
  );

  if (exactIndex !== -1) {
    return exactIndex;
  }

  return findUniqueRowIndex(
    rows,
    (row) => matchesTextField(row, masterFieldCandidates.companyName, lookup.companyName || "")
  );
}

function findDueRowIndex(rows: RawRow[], lookup: DueRowLookup) {
  const exactIndex = rows.findIndex(
    (row) =>
      matchesTextField(row, dueFieldCandidates.customerCode, lookup.customerCode) &&
      matchesTextField(row, dueFieldCandidates.invoiceNumber, lookup.invoiceNumber || "") &&
      matchesDateField(row, dueFieldCandidates.dueDate, lookup.dueDate || "")
  );

  if (exactIndex !== -1) {
    return exactIndex;
  }

  const fallbackMatchers = [
    (row: RawRow) =>
      matchesTextField(row, dueFieldCandidates.customerCode, lookup.customerCode) &&
      matchesTextField(row, dueFieldCandidates.invoiceNumber, lookup.invoiceNumber || ""),
    (row: RawRow) =>
      matchesTextField(row, dueFieldCandidates.customerCode, lookup.customerCode) &&
      matchesDateField(row, dueFieldCandidates.dueDate, lookup.dueDate || ""),
    (row: RawRow) =>
      matchesTextField(row, dueFieldCandidates.invoiceNumber, lookup.invoiceNumber || "") &&
      matchesDateField(row, dueFieldCandidates.dueDate, lookup.dueDate || ""),
    (row: RawRow) =>
      matchesTextField(row, dueFieldCandidates.companyName, lookup.companyName || "") &&
      matchesTextField(row, dueFieldCandidates.invoiceNumber, lookup.invoiceNumber || ""),
    (row: RawRow) =>
      matchesTextField(row, dueFieldCandidates.invoiceNumber, lookup.invoiceNumber || ""),
    (row: RawRow) =>
      matchesTextField(row, dueFieldCandidates.companyName, lookup.companyName || "") &&
      matchesDateField(row, dueFieldCandidates.dueDate, lookup.dueDate || "")
  ];

  for (const matcher of fallbackMatchers) {
    const index = findUniqueRowIndex(rows, matcher);
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function scoreHeaderRow(values: unknown[], candidates: Set<string>) {
  return values.reduce<number>((score, value) => {
    const normalized = normalizeHeader(toText(value));
    return normalized && candidates.has(normalized) ? score + 1 : score;
  }, 0);
}

function detectHeaderRow(worksheet: XLSX.WorkSheet, kind: ImportKind) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  });
  const candidates = getCandidateHeaders(kind);
  const scanLimit = Math.min(rows.length, 10);
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < scanLimit; index += 1) {
    const score = scoreHeaderRow(rows[index] || [], candidates);
    if (score > bestScore) {
      bestRowIndex = index;
      bestScore = score;
    }
  }

  return bestRowIndex;
}

export function parseWorkbook(buffer: Buffer, kind: ImportKind) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("The uploaded file does not contain a readable sheet.");
  }

  const headerRowIndex = detectHeaderRow(worksheet, kind);

  return XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    range: headerRowIndex,
    defval: "",
    raw: true
  });
}

function getWorkbookDirectory(ownerId: string) {
  return path.join(process.cwd(), "data", "workbooks", ownerId);
}

export function getStoredWorkbookPath(ownerId: string, kind: ImportKind) {
  return path.join(getWorkbookDirectory(ownerId), storedWorkbookFileNames[kind]);
}

function readWorkbookOrThrow(buffer: Buffer, kind: ImportKind) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`The stored ${kind} workbook does not contain a readable sheet.`);
  }

  return { workbook, sheetName, worksheet };
}

function collectColumnOrder(
  worksheetRows: unknown[][],
  headerRowIndex: number,
  rows: RawRow[]
) {
  const sheetHeaders = (worksheetRows[headerRowIndex] || [])
    .map((value) => toText(value))
    .filter((value) => value !== "");
  const rowHeaders = rows.flatMap((row) =>
    Object.keys(row).filter((key) => key.trim() !== "")
  );

  return Array.from(new Set([...sheetHeaders, ...rowHeaders]));
}

function rebuildWorksheet(
  worksheet: XLSX.WorkSheet,
  headerRowIndex: number,
  rows: RawRow[]
) {
  const worksheetRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: true
  });
  const preservedRows = worksheetRows.slice(0, headerRowIndex);
  const columnOrder = collectColumnOrder(worksheetRows, headerRowIndex, rows);
  const nextRows = rows.map((row) => columnOrder.map((header) => row[header] ?? ""));
  const nextWorksheet = XLSX.utils.aoa_to_sheet([...preservedRows, columnOrder, ...nextRows]);

  if (worksheet["!cols"]) {
    nextWorksheet["!cols"] = worksheet["!cols"];
  }

  return nextWorksheet;
}

function buildWorkbookFromRows(rows: RawRow[], kind: ImportKind) {
  const columnOrder = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key.trim() !== "")))
  );
  const worksheet = XLSX.utils.aoa_to_sheet([
    columnOrder,
    ...rows.map((row) => columnOrder.map((header) => row[header] ?? ""))
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    kind === "master" ? "Master Database" : "Due Database"
  );

  return workbook;
}

export async function writeStoredWorkbookRows(ownerId: string, kind: ImportKind, rows: RawRow[]) {
  const directory = getWorkbookDirectory(ownerId);
  const filePath = getStoredWorkbookPath(ownerId, kind);

  await mkdir(directory, { recursive: true });
  await writeFile(
    filePath,
    XLSX.write(buildWorkbookFromRows(rows, kind), { type: "buffer", bookType: "xlsx" })
  );

  return filePath;
}

export async function deleteStoredWorkbook(ownerId: string, kind: ImportKind) {
  const filePath = getStoredWorkbookPath(ownerId, kind);
  await rm(filePath, { force: true });
  return filePath;
}

export async function saveUploadedWorkbook(ownerId: string, kind: ImportKind, buffer: Buffer) {
  const rows = parseWorkbook(buffer, kind);
  return writeStoredWorkbookRows(ownerId, kind, rows);
}

export async function readStoredWorkbookRows(ownerId: string, kind: ImportKind) {
  const filePath = getStoredWorkbookPath(ownerId, kind);
  const buffer = await readFile(filePath).catch(() => {
    throw new Error(`No stored ${kind} workbook was found for this user.`);
  });
  const { workbook, sheetName, worksheet } = readWorkbookOrThrow(buffer, kind);
  const headerRowIndex = detectHeaderRow(worksheet, kind);
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    range: headerRowIndex,
    defval: "",
    raw: true
  });

  return {
    filePath,
    workbook,
    sheetName,
    worksheet,
    headerRowIndex,
    rows
  };
}

export async function updateStoredWorkbookRows(
  ownerId: string,
  kind: ImportKind,
  updater: WorkbookUpdateHandler
) {
  const { filePath, workbook, sheetName, worksheet, headerRowIndex, rows } =
    await readStoredWorkbookRows(ownerId, kind);
  const nextRows = await updater(rows);

  workbook.Sheets[sheetName] = rebuildWorksheet(worksheet, headerRowIndex, nextRows);
  await writeFile(filePath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  return {
    filePath,
    rowCount: nextRows.length,
    rows: nextRows
  };
}

export async function upsertStoredMasterWorkbookRow(
  ownerId: string,
  lookup: MasterRowLookup,
  changes: MasterRowChanges
) {
  return updateStoredWorkbookRows(ownerId, "master", (rows) => {
    const rowIndex = findMasterRowIndex(rows, lookup);

    if (rowIndex === -1) {
      throw new Error("The selected master row could not be found in the stored workbook.");
    }

    const nextRows = [...rows];
    nextRows[rowIndex] = applyMasterRowChanges(rows[rowIndex], changes);
    return nextRows;
  });
}

function applyMasterRowChanges(row: RawRow, changes: MasterRowChanges) {
  let nextRow = { ...row };
  nextRow = setRowField(
    nextRow,
    masterFieldCandidates.customerCode,
    "Customer Code",
    changes.customerCode
  );
  nextRow = setRowField(
    nextRow,
    masterFieldCandidates.companyName,
    "Company Name",
    changes.companyName
  );
  nextRow = setRowField(
    nextRow,
    masterFieldCandidates.primaryContact,
    "Contact Person",
    changes.primaryContact
  );
  nextRow = setRowField(nextRow, masterFieldCandidates.email, "Email", changes.email);
  nextRow = setRowField(nextRow, masterFieldCandidates.whatsapp, "WhatsApp", changes.whatsapp);
  nextRow = setRowField(nextRow, masterFieldCandidates.sms, "Phone", changes.sms);
  nextRow = setRowField(
    nextRow,
    masterFieldCandidates.alternateContact,
    "Alternate Contact",
    changes.alternateContact
  );
  nextRow = setRowField(nextRow, masterFieldCandidates.notes, "Notes", changes.notes);
  return nextRow;
}

export async function saveStoredMasterWorkbookRows(
  ownerId: string,
  entries: Array<{
    lookup?: MasterRowLookup;
    changes: MasterRowChanges;
  }>
) {
  return updateStoredWorkbookRows(ownerId, "master", (rows) => {
    const nextRows = [...rows];

    entries.forEach((entry, index) => {
      if (!entry.changes.customerCode.trim() || !entry.changes.companyName.trim()) {
        throw new Error(`Row ${index + 1} must include both customer code and company name.`);
      }

      if (entry.lookup?.customerCode?.trim()) {
        const rowIndex = findMasterRowIndex(nextRows, entry.lookup);

        if (rowIndex === -1) {
          throw new Error(
            `The stored master row for ${entry.lookup.customerCode} could not be found.`
          );
        }

        nextRows[rowIndex] = applyMasterRowChanges(nextRows[rowIndex], entry.changes);
        return;
      }

      nextRows.push(applyMasterRowChanges({}, entry.changes));
    });

    return nextRows;
  });
}

export async function upsertStoredDueWorkbookRow(
  ownerId: string,
  lookup: DueRowLookup,
  changes: DueRowChanges
) {
  return updateStoredWorkbookRows(ownerId, "due", (rows) => {
    const rowIndex = findDueRowIndex(rows, lookup);

    if (rowIndex === -1) {
      throw new Error("The selected due row could not be found in the stored workbook.");
    }

    const nextRows = [...rows];
    nextRows[rowIndex] = applyDueRowChanges(rows[rowIndex], changes);
    return nextRows;
  });
}

function applyDueRowChanges(row: RawRow, changes: DueRowChanges) {
  let nextRow = { ...row };
  nextRow = setRowField(
    nextRow,
    dueFieldCandidates.customerCode,
    "Customer Code",
    changes.customerCode
  );
  nextRow = setRowField(
    nextRow,
    dueFieldCandidates.companyName,
    "Company Name",
    changes.companyName
  );
  nextRow = setRowField(
    nextRow,
    dueFieldCandidates.invoiceNumber,
    "Invoice Number",
    changes.invoiceNumber
  );
  nextRow = setRowField(
    nextRow,
    dueFieldCandidates.invoiceDate,
    "Invoice Date",
    changes.invoiceDate
  );
  nextRow = setRowField(nextRow, dueFieldCandidates.dueDate, "Due Date", changes.dueDate);
  nextRow = setRowField(nextRow, dueFieldCandidates.amount, "Amount", changes.amount);
  nextRow = setRowField(nextRow, dueFieldCandidates.currency, "Currency", changes.currency);
  nextRow = setRowField(nextRow, dueFieldCandidates.reference, "Reference", changes.reference);
  nextRow = setRowField(nextRow, dueFieldCandidates.notes, "Notes", changes.notes);
  return nextRow;
}

export async function saveStoredDueWorkbookRows(
  ownerId: string,
  entries: Array<{
    lookup?: DueRowLookup;
    changes: DueRowChanges;
  }>
) {
  return updateStoredWorkbookRows(ownerId, "due", (rows) => {
    const nextRows = [...rows];

    entries.forEach((entry, index) => {
      if (
        !entry.changes.customerCode.trim() ||
        !entry.changes.companyName.trim() ||
        !entry.changes.dueDate.trim()
      ) {
        throw new Error(
          `Row ${index + 1} must include customer code, company name, and due date.`
        );
      }

      if (entry.lookup?.customerCode?.trim()) {
        const rowIndex = findDueRowIndex(nextRows, entry.lookup);

        if (rowIndex === -1) {
          throw new Error(
            `The stored workbook row for customer ${entry.lookup.customerCode} could not be found.`
          );
        }

        nextRows[rowIndex] = applyDueRowChanges(nextRows[rowIndex], entry.changes);
        return;
      }

      nextRows.push(applyDueRowChanges({}, entry.changes));
    });

    return nextRows;
  });
}

export function mapMasterRows(rows: RawRow[], ownerId: string) {
  const importedAt = new Date().toISOString();

  return rows
    .map(normalizeRow)
    .filter(
      (row) =>
        toText(pickValue(row, masterFieldCandidates.customerCode)) !== "" &&
        toText(pickValue(row, masterFieldCandidates.companyName)) !== ""
    )
    .map<MasterContact>((row) => ({
      id: randomUUID(),
      ownerId,
      customerCode: toText(pickValue(row, masterFieldCandidates.customerCode)),
      companyName: toText(pickValue(row, masterFieldCandidates.companyName)),
      primaryContact: toText(pickValue(row, masterFieldCandidates.primaryContact)),
      email: toText(pickValue(row, masterFieldCandidates.email)),
      whatsapp: toText(pickValue(row, masterFieldCandidates.whatsapp)),
      sms: toText(pickValue(row, masterFieldCandidates.sms)),
      alternateContact: toText(pickValue(row, masterFieldCandidates.alternateContact)),
      notes: toText(pickValue(row, masterFieldCandidates.notes)),
      importedAt,
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, toText(value)])
      )
    }));
}

export function mapDueRows(rows: RawRow[], ownerId: string) {
  const importedAt = new Date().toISOString();

  return rows
    .map(normalizeRow)
    .filter(
      (row) =>
        toText(pickValue(row, dueFieldCandidates.customerCode)) !== "" &&
        toText(pickValue(row, dueFieldCandidates.companyName)) !== "" &&
        toDateValue(pickValue(row, dueFieldCandidates.dueDate)) !== ""
    )
    .map<DueRecord>((row) => ({
      id: randomUUID(),
      ownerId,
      customerCode: toText(pickValue(row, dueFieldCandidates.customerCode)),
      companyName: toText(pickValue(row, dueFieldCandidates.companyName)),
      invoiceNumber: toText(pickValue(row, dueFieldCandidates.invoiceNumber)),
      invoiceDate: toDateValue(pickValue(row, dueFieldCandidates.invoiceDate)),
      dueDate: toDateValue(pickValue(row, dueFieldCandidates.dueDate)),
      amount: toAmount(pickValue(row, dueFieldCandidates.amount)),
      currency: toText(pickValue(row, dueFieldCandidates.currency)) || "INR",
      reference: toText(pickValue(row, dueFieldCandidates.reference)),
      notes: toText(pickValue(row, dueFieldCandidates.notes)),
      importedAt,
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, toText(value)])
      )
    }));
}
