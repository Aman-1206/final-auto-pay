import type { DueRecord, MasterContact } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

type DueMatchInput = Pick<
  DueRecord,
  | "dealerCode"
  | "customerCode"
  | "companyName"
  | "matchedContactId"
  | "matchedContactName"
  | "matchedEmail"
  | "matchedWhatsapp"
  | "matchedSms"
  | "contactMatchStatus"
>;

export function findMatchingMasterContact(due: DueMatchInput, contacts: MasterContact[]) {
  const dealerCode = normalizeText(due.dealerCode || due.customerCode || "");

  if (dealerCode) {
    const codeMatch = contacts.find(
      (contact) => normalizeText(contact.dealerCode || contact.customerCode || "") === dealerCode
    );

    if (codeMatch) {
      return codeMatch;
    }
  }

  if (due.matchedContactId) {
    const matchedContact = contacts.find((contact) => contact.id === due.matchedContactId);
    if (matchedContact) {
      return matchedContact;
    }
  }

  const companyKey = normalizeText(due.companyName);
  return contacts.find((contact) => normalizeText(contact.companyName) === companyKey) ?? null;
}

export function buildDueContactMatch(due: DueMatchInput, contacts: MasterContact[]) {
  const matchedContact = findMatchingMasterContact(due, contacts);

  return {
    matchedContact,
    matchedContactId: matchedContact?.id || "",
    matchedContactName: matchedContact?.primaryContact || "",
    matchedEmail: matchedContact?.email || "",
    matchedWhatsapp: matchedContact?.whatsapp || "",
    matchedSms: matchedContact?.sms || "",
    contactMatchStatus: matchedContact ? ("matched" as const) : ("missing" as const),
    companyName: due.companyName || matchedContact?.companyName || ""
  };
}
