import type { ReminderLog } from "@/lib/types";

type Channel = ReminderLog["channel"];

export function ChannelLabel({ channel }: { channel: Channel }) {
  return (
    <span className={`channel-label channel-label-${channel}`}>
      <ChannelIcon channel={channel} />
      <span>{formatChannelLabel(channel)}</span>
    </span>
  );
}

export function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === "email") {
    return (
      <svg className="channel-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 5.5h14v9H3z" />
        <path d="m3.5 6 6.5 5 6.5-5" />
      </svg>
    );
  }

  if (channel === "whatsapp") {
    return (
      <svg className="channel-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 3.2a6.6 6.6 0 0 0-5.7 10l-.8 3.2 3.3-.8A6.6 6.6 0 1 0 10 3.2Z" />
        <path d="M7.7 7.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.5 1.1c.1.2 0 .4-.1.6l-.4.5c.5.8 1.2 1.4 2.1 1.8l.5-.5c.2-.2.4-.2.6-.1l1.1.5c.3.1.4.3.4.6v.5c0 .3-.2.6-.5.7-.4.2-.8.3-1.2.3-2.3 0-5.4-2.6-5.4-5 0-.3.1-.7.2-1Z" />
      </svg>
    );
  }

  return (
    <svg className="channel-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 4.5h12v8.3H9.2L5.5 16v-3.2H4z" />
      <path d="M7 8h6M7 10.5h4" />
    </svg>
  );
}

export function formatChannelLabel(channel: Channel) {
  if (channel === "whatsapp") {
    return "WhatsApp";
  }

  if (channel === "sms") {
    return "SMS";
  }

  return "Email";
}
