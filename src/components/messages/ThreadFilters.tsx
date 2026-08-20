import { Search } from "lucide-react";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  contacts: Array<{ id: string; label: string }>;
  contactId: string;
  onContact: (v: string) => void;
  count: number;
}

export function ThreadFilters({
  search,
  onSearch,
  from,
  to,
  onFrom,
  onTo,
  contacts,
  contactId,
  onContact,
  count,
}: Props) {
  return (
    <div
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      style={{
        background: "var(--pp-card)",
        border: "1px solid rgba(26,18,36,0.14)",
        borderRadius: 2,
        padding: 12,
      }}
    >
      <div className="relative">
        <Search
          size={14}
          style={{ position: "absolute", left: 10, top: 14, color: "rgba(26,18,36,0.45)" }}
        />
        <input
          className="input-pp"
          style={{ paddingLeft: 30, minHeight: 44 }}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search this conversation"
          aria-label="Search messages"
        />
      </div>
      <select
        className="input-pp"
        style={{ minHeight: 44 }}
        value={contactId}
        onChange={(e) => onContact(e.target.value)}
        aria-label="Conversation"
      >
        <option value="all">All conversations</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        className="input-pp"
        style={{ minHeight: 44 }}
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        aria-label="From date"
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          className="input-pp"
          style={{ minHeight: 44 }}
          value={to}
          onChange={(e) => onTo(e.target.value)}
          aria-label="To date"
        />
        <span className="mono-meta mono-meta--muted whitespace-nowrap">{count} shown</span>
      </div>
    </div>
  );
}
