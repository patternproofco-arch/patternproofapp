import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listIncidents from "./tools/list-incidents";
import createIncident from "./tools/create-incident";
import listEvidence from "./tools/list-evidence";
import searchCase from "./tools/search";

// Direct Supabase issuer host — the .lovable.cloud proxy publishes a different
// issuer in discovery and mcp-js would reject tokens (RFC 8414 §3.3).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "patternproof-mcp",
  title: "PatternProof",
  version: "0.1.0",
  instructions:
    "Tools for PatternProof — a private evidence and incident journal for survivors of domestic abuse, high-conflict custody, and divorce. Every tool acts as the signed-in survivor and reads or writes only their own private case data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listIncidents, createIncident, listEvidence, searchCase],
});