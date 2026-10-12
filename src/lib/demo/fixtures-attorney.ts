/**
 * Fictional attorney-portal fixtures for /demo/attorney.
 * All people, firms, emails (@example.invalid) and phones (555-01xx) are invented.
 */
import type { WorkQueueCardModel } from "@/components/attorney/AttorneyWorkQueue";
import type { MatrixInputMessage } from "@/lib/frequency-matrix";

export type DemoAttorneyClient = {
  clientId: string;
  displayName: string;
  matter: string;
  sharedSince: string;
  contactEmail: string;
  contactPhone: string;
  incidents: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  requests: Array<Record<string, unknown>>;
};

export const DEMO_FIRM = {
  name: "Harbor Lane Family Law (fictional)",
  attorney: "Avery Quinn, Esq. (fictional)",
  email: "avery.quinn@example.invalid",
  phone: "(555) 010-0142",
} as const;

export const DEMO_ATTORNEY_CLIENTS: DemoAttorneyClient[] = [
  {
    clientId: "demo-client-rm",
    displayName: "Client R.M. (fictional)",
    matter: "Custody modification — sample matter",
    sharedSince: "2026-01-12",
    contactEmail: "rm.sample@example.invalid",
    contactPhone: "(555) 010-0117",
    incidents: [
      {
        id: "rm-i1",
        date: "2025-09-14",
        title: "Late-night text messages after mention of moving",
        description:
          "47 messages between 11:42 PM and 1:08 AM, as logged by the client. Copied from the client's own entry; not interpreted.",
      },
      {
        id: "rm-i2",
        date: "2025-10-02",
        title: "Exchange at school pickup",
        description:
          "Client logged raised voices during the exchange and that a child's medication was not handed over. Two witnesses listed by first name only.",
      },
      {
        id: "rm-i3",
        date: "2025-11-03",
        title: "Joint account withdrawal",
        description: "Client logged a withdrawal they did not expect from a joint account.",
      },
    ],
    evidence: [
      {
        id: "rm-e1",
        date: "2025-09-14",
        title: "Text thread export (sample)",
        description: "Fictional export file. File name and timestamps only.",
      },
      {
        id: "rm-e2",
        date: "2025-11-04",
        title: "Bank statement page (sample)",
        description: "Fictional statement page with one highlighted line.",
      },
    ],
    requests: [
      {
        id: "rm-r1",
        status: "submitted",
        submitted_at: "2025-12-01T15:00:00Z",
        title: "School counselor email",
        response_note: "Client shared one email from the counselor (fictional).",
      },
    ],
  },
  {
    clientId: "demo-client-jt",
    displayName: "Client J.T. (fictional)",
    matter: "Protective order — sample matter",
    sharedSince: "2026-02-03",
    contactEmail: "jt.sample@example.invalid",
    contactPhone: "(555) 010-0163",
    incidents: [
      {
        id: "jt-i1",
        date: "2026-01-20",
        title: "Unannounced visit to residence",
        description: "Client logged an unannounced visit and a damaged door frame.",
      },
    ],
    evidence: [],
    requests: [],
  },
];

export const DEMO_WORK_QUEUE: WorkQueueCardModel[] = [
  {
    id: "demo-q-1",
    name: "Client R.M. (fictional)",
    clientId: "demo-client-rm",
    chip: "New since you looked",
    softGaps: null,
    askItem: "an update on the file",
  },
  {
    id: "demo-q-2",
    name: "Client J.T. (fictional)",
    clientId: "demo-client-jt",
    chip: "Unanswered ask",
    softGaps: "Shared: timeline notes · Not shared: files",
    askItem: "files you’re ready to include",
  },
  {
    id: "demo-q-3",
    name: "pending.sample@example.invalid",
    chip: "Pending invite",
    softGaps: null,
    askItem: "an invite acceptance when you’re ready",
  },
];

/** Fictional message metadata for the frequency-matrix preview. No message bodies. */
export const DEMO_MATRIX_MESSAGES: MatrixInputMessage[] = [
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-09-14",
    sent_at_time: "23:42",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-09-14",
    sent_at_time: "23:55",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-09-15",
    sent_at_time: "00:31",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-09-15",
    sent_at_time: "01:08",
  },
  {
    sender: "Client R.M. (fictional)",
    sender_side: "outgoing",
    sent_on: "2025-09-15",
    sent_at_time: "07:10",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-10-02",
    sent_at_time: "15:20",
  },
  {
    sender: "Client R.M. (fictional)",
    sender_side: "outgoing",
    sent_on: "2025-10-02",
    sent_at_time: "15:41",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-10-19",
    sent_at_time: "21:50",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-11-03",
    sent_at_time: "10:30",
  },
  {
    sender: "Client R.M. (fictional)",
    sender_side: "outgoing",
    sent_on: "2025-11-03",
    sent_at_time: "11:02",
  },
  {
    sender: "Other parent (fictional)",
    sender_side: "incoming",
    sent_on: "2025-12-08",
    sent_at_time: "18:45",
  },
];

export function getDemoAttorneyClient(clientId: string): DemoAttorneyClient | undefined {
  return DEMO_ATTORNEY_CLIENTS.find((c) => c.clientId === clientId);
}
