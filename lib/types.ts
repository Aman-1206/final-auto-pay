export type UserRole = "admin" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  companyName: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string;
};

export type AuthEvent = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  companyName: string;
  userRole: UserRole;
  type: "login" | "logout";
  sessionTokenSuffix: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
};

export type MasterContact = {
  id: string;
  ownerId: string;
  dealerCode: string;
  customerCode: string;
  companyName: string;
  primaryContact: string;
  email: string;
  whatsapp: string;
  sms: string;
  alternateContact: string;
  notes: string;
  importedAt: string;
  raw: Record<string, string>;
};

export type DueRecord = {
  id: string;
  ownerId: string;
  dealerCode: string;
  customerCode: string;
  companyName: string;
  billDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  openingAmount: number;
  amount: number;
  currency: string;
  overdueDays: number;
  reference: string;
  notes: string;
  matchedContactId: string;
  matchedContactName: string;
  matchedEmail: string;
  matchedWhatsapp: string;
  matchedSms: string;
  contactMatchStatus: "matched" | "missing";
  importedAt: string;
  raw: Record<string, string>;
};

export type ReminderRule = {
  id: string;
  ownerId: string;
  name: string;
  triggerDay: number;
  enabled: boolean;
  autoSend: boolean;
  channels: {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  };
  templateId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderTemplate = {
  id: string;
  ownerId: string;
  ruleId: string;
  name: string;
  emailSubject: string;
  emailBody: string;
  whatsappBody: string;
  smsBody: string;
  updatedAt: string;
};

export type DispatchSettings = {
  ownerId: string;
  simulateMode: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  senderEmail: string;
  senderMobileNumber: string;
  smtpFrom: string;
  smsProviderName: string;
  smsApiKey: string;
  smsApiSecret: string;
  smsAccountSid: string;
  smsAuthToken: string;
  smsFromNumber: string;
  smsSenderId: string;
  whatsappProviderName: string;
  whatsappApiKey: string;
  whatsappApiSecret: string;
  whatsappAccountSid: string;
  whatsappAuthToken: string;
  whatsappFromNumber: string;
  whatsappWebhookUrl: string;
  futureIntegrationNotes: string;
  updatedAt: string;
};

export type CashDiscountPolicy = {
  id: string;
  ownerId: string;
  name: string;
  paymentWindowDays: number;
  discountPercent: number;
  enabled: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderLog = {
  id: string;
  ownerId: string;
  dueId: string;
  dedupeKey: string;
  contactId: string;
  ruleId: string;
  templateId: string;
  dealerCode: string;
  invoiceNumber: string;
  reminderDay: number;
  billAgeDays: number;
  cdEligible: boolean;
  cdPolicyId: string;
  cdDiscountPercent: number;
  cdReason: string;
  channel: "email" | "whatsapp" | "sms";
  recipient: string;
  scheduledFor: string;
  status: "pending" | "simulated" | "sent" | "failed";
  subject: string;
  content: string;
  failureReason: string;
  sentAt: string;
  createdAt: string;
};

export type AppDatabase = {
  users: User[];
  sessions: Session[];
  authEvents: AuthEvent[];
  masterContacts: MasterContact[];
  dueRecords: DueRecord[];
  reminderRules: ReminderRule[];
  templates: ReminderTemplate[];
  dispatchSettings: DispatchSettings[];
  cashDiscountPolicies: CashDiscountPolicy[];
  reminderLogs: ReminderLog[];
};

export type DashboardStats = {
  masterCount: number;
  dueCount: number;
  pendingReminders: number;
  sentReminders: number;
};
