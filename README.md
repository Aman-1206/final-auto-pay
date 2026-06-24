# Auto Payment Reminder

A Next.js 16 app for uploading a master contact database and a changing dues sheet, then generating payment reminders across email, WhatsApp, and SMS.

## What it includes

- Homepage, signup, login, and protected dashboard pages
- Master database upload for company contact details
- Dues Excel upload for invoice and due date tracking
- Automatic reminder checking whenever a new dues file is uploaded
- Flexible reminder rules like 30, 45, and 90 days before due date
- Editable templates for email, WhatsApp, and SMS
- Dispatch center with SMTP email, Twilio SMS, and Interakt WhatsApp delivery
- MongoDB-backed persistence for users, uploads, rules, templates, and reminder logs

## Expected Excel headers

The importer is flexible, but these header names work best:

### Master database

- `Customer Code`
- `Company Name`
- `Contact Person`
- `Email`
- `WhatsApp`
- `Phone`

### Dues upload

- `Customer Code`
- `Company Name`
- `Invoice Number`
- `Invoice Date`
- `Due Date`
- `Amount`
- `Currency`

## Template variables

Use these in rule templates:

- `{{contactName}}`
- `{{companyName}}`
- `{{invoiceNumber}}`
- `{{amount}}`
- `{{dueDate}}`
- `{{daysBeforeDue}}`
- `{{reference}}`
- `{{senderCompany}}`

## Run locally

```bash
npm.cmd install
copy .env.example .env.local
npm.cmd run dev
```

Open `http://localhost:3000`.

## Notes

- The app now requires `MONGODB_URI` and `MONGODB_DB` in `.env.local`.
- If an old `data/app-db.json` file exists, the app seeds MongoDB from it the first time the MongoDB state document is created.
- New accounts start with editable provider settings before live sending.
- Dues uploads are the main trigger for reminder generation, so you do not need a daily check to keep the queue updated.
- SMS sending uses Twilio.
- WhatsApp sending uses Interakt template messages.
- For production, move passwords and provider credentials to a secure database or secret manager.
- `CRON_SECRET` can be used to protect `POST /api/cron/run`.
- SMTP, Twilio SMS, and Interakt WhatsApp values in `.env.local` act as fallbacks if those fields are empty in the dashboard.
