import type { AppDatabase, Salesperson, User } from "@/lib/types";

function normalizeDealerCode(value: string) {
  return value.trim().toLowerCase();
}

export function applySalespersonMappings(
  database: AppDatabase,
  salespersons: Salesperson[],
  sharedOwnerIds: Set<string>,
  updatedBy: Pick<User, "id">
) {
  const dealerMap = new Map<string, Salesperson>();

  salespersons.forEach((salesperson) => {
    salesperson.dealerCodes.forEach((dealerCode) => {
      const key = normalizeDealerCode(dealerCode);
      if (key) {
        dealerMap.set(key, salesperson);
      }
    });
  });

  database.masterContacts.forEach((contact) => {
    if (!sharedOwnerIds.has(contact.ownerId)) {
      return;
    }

    const salesperson = dealerMap.get(
      normalizeDealerCode(contact.dealerCode || contact.customerCode)
    );

    if (!salesperson) {
      return;
    }

    contact.salespersonId = salesperson.id;
    contact.salespersonName = salesperson.name;
    contact.salespersonEmail = salesperson.email;
  });

  database.dueRecords.forEach((due) => {
    if (!sharedOwnerIds.has(due.ownerId)) {
      return;
    }

    const salesperson = dealerMap.get(normalizeDealerCode(due.dealerCode || due.customerCode));

    if (!salesperson) {
      return;
    }

    due.salespersonId = salesperson.id;
    due.salespersonName = salesperson.name;
    due.salespersonEmail = salesperson.email;
    due.updatedBy = updatedBy.id;
  });
}
