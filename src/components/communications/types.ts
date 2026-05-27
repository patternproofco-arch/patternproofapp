import { MessageCircle, Phone, Mail, Voicemail, Share2, Users, type LucideIcon } from "lucide-react";

export type Channel = "text" | "call" | "email" | "voicemail" | "social" | "in_person" | "other";
export type Direction = "incoming" | "outgoing" | "missed";

export interface Comm {
  id: string;
  date: string;
  time: string | null;
  channel: Channel;
  direction: Direction;
  from_party: string | null;
  content: string | null;
  screenshot_url: string | null;
  harassment_flag: boolean;
  notes: string | null;
  linked_incident_id: string | null;
  created_at: string;
}

export interface IncidentLite {
  id: string;
  date: string;
  description: string;
}

export interface ChannelMeta {
  value: Channel;
  label: string;
  Icon: LucideIcon;
  accentVar: string;
}

export const CHANNELS: ChannelMeta[] = [
  { value: "text", label: "Text", Icon: MessageCircle, accentVar: "var(--accent)" },
  { value: "call", label: "Call", Icon: Phone, accentVar: "var(--secondary)" },
  { value: "email", label: "Email", Icon: Mail, accentVar: "var(--accent)" },
  { value: "voicemail", label: "Voicemail", Icon: Voicemail, accentVar: "var(--secondary)" },
  { value: "social", label: "Social", Icon: Share2, accentVar: "var(--accent)" },
  { value: "in_person", label: "In person", Icon: Users, accentVar: "var(--secondary)" },
  { value: "other", label: "Other", Icon: MessageCircle, accentVar: "var(--muted)" },
];

export function channelMeta(c: Channel): ChannelMeta {
  return CHANNELS.find((x) => x.value === c) ?? CHANNELS[CHANNELS.length - 1];
}

export function incidentLabel(i: IncidentLite): string {
  const desc = (i.description || "").replace(/\s+/g, " ").trim();
  const short = desc.length > 48 ? `${desc.slice(0, 48)}…` : desc;
  return `${i.date} · ${short || "(no description)"}`;
}