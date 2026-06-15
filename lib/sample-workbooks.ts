import * as XLSX from "xlsx";

type SampleWorkbookKind = "master" | "due" | "salesperson";

type SampleWorkbookConfig = {
  fileName: string;
  sheetName: string;
  rows: Array<Record<string, string | number>>;
};

const sampleWorkbooks: Record<SampleWorkbookKind, SampleWorkbookConfig> = {
  master: {
    fileName: "sample-master-database.xlsx",
    sheetName: "Master Database",
    rows: [
      {
        "Dealer Code": "DLR-001",
        "Company Name": "Example Trading Co.",
        "Contact Person": "Ravi Sharma",
        Email: "accounts@exampletrading.com",
        WhatsApp: "919876543210",
        Phone: "919876543210",
        "Alternate Contact": "919812345670",
        Notes: "Primary billing contact",
        "Salesperson ID": "SP-001",
        Salesperson: "Aman Kumar",
        "Salesperson Email": "aman@example.com"
      }
    ]
  },
  due: {
    fileName: "sample-due-database.xlsx",
    sheetName: "Due Database",
    rows: [
      {
        "Dealer Code": "DLR-001",
        "Company Name": "Example Trading Co.",
        "Invoice Number": "INV-1001",
        "Bill Date": "2026-06-01",
        "Due Date": "2026-06-15",
        "Opening Amount": 50000,
        "Pending Amount": 35000,
        Currency: "INR",
        "Overdue by days": 0,
        Reference: "PO-7788",
        Notes: "First reminder eligible after due date",
        "Total Due Amount": 35000,
        "Salesperson ID": "SP-001",
        Salesperson: "Aman Kumar",
        "Salesperson Email": "aman@example.com"
      }
    ]
  },
  salesperson: {
    fileName: "sample-salesperson-mapping.xlsx",
    sheetName: "Salespersons",
    rows: [
      {
        "Salesperson Name": "Aman Kumar",
        "Employee ID": "SP-001",
        Email: "aman@example.com",
        "Phone Number": "919876543210",
        "Dealer Codes": "DLR-001, DLR-002"
      }
    ]
  }
};

function buildWorkbook(rows: SampleWorkbookConfig["rows"], sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] || {}).map((header) => ({
    wch: Math.max(header.length + 2, 18)
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

export function buildSampleWorkbookResponse(kind: SampleWorkbookKind) {
  const config = sampleWorkbooks[kind];
  const workbook = buildWorkbook(config.rows, config.sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${config.fileName}"`
    }
  });
}
