import TeamInvitationEmail from "./team-invitation";
import type { TemplateEntry } from "./registry";

export const teamInvitationSubject = (teamName: unknown) =>
  `Invitation to join ${String(teamName || "a PatternProof team")}`;

export const template = {
  component: TeamInvitationEmail,
  subject: ({ teamName }: Record<string, unknown>) => teamInvitationSubject(teamName),
  displayName: "Team invitation",
  previewData: {
    teamName: "Example Legal",
    teamKind: "firm",
    role: "member",
    acceptUrl: "https://pattern-proof.tech/team-invite#firm=example",
    expiresLabel: "7 days",
  },
} satisfies TemplateEntry;
