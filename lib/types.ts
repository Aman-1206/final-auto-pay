export type User = {
  id: string;
  name: string;
  email: string;
  companyName: string;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type MasterContact = {
  id: string;
  ownerId: string;
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
  customerCode: string;
  companyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  reference: string;
  notes: string;
  importedAt: string;
  raw: Record<string, string>;
};

export type ReminderRule = {
  id: string;
  ownerId: string;
  name: string;
  daysBeforeDue: number;
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
  smtpFrom: string;
  smsFromNumber: string;
  whatsappFromNumber: string;
  smsSenderId?: string;
  whatsappWebhookUrl?: string;
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
  masterContacts: MasterContact[];
  dueRecords: DueRecord[];
  reminderRules: ReminderRule[];
  templates: ReminderTemplate[];
  dispatchSettings: DispatchSettings[];
  reminderLogs: ReminderLog[];
};

export type DashboardStats = {
  masterCount: number;
  dueCount: number;
  pendingReminders: number;
  sentReminders: number;
};
