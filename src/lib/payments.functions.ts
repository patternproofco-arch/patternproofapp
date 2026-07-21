import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import JSZip from "jszip";
import { createHash } from "crypto";
import { z } from "zod";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };
type SubRow = {
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null;

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { userId, supabase } = context;
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email ?? undefined;

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId, managed_payments: "true" },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
        // managed_payments enabled via cast — SDK types don't yet include it
        ...({ managed_payments: { enabled: true } } as Record<string, unknown>),
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Pay-What-You-Can checkout for the Court Ready tier.
 * Survivors choose any amount from $1 to $500 (one-time payment).
 */
export const createPayWhatYouCanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      amountInCents: z.number().int().min(100).max(50000),
      returnUrl: z.string().url(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { userId, supabase } = context;
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email ?? undefined;
      const stripe = createStripeClient(data.environment as StripeEnv);
      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "PatternProof Court Ready — Pay What You Can" },
            unit_amount: data.amountInCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: "PatternProof Court Ready — Pay What You Can" },
        metadata: { userId, tier: "court_ready_pwyc" },
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return { error: "No subscription found" };
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<{ subscription: SubRow }> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: (row as SubRow) ?? null };
  });

/**
 * Entitlement: attorney needs an active PatternProof attorney subscription.
 * "The Pilot" (first client free) is marketing copy on the pricing page —
 * full app access requires an active Solo/Firm/Enterprise subscription.
 */
async function isAttorneyEntitled(attorneyId: string, clientId: string): Promise<{ entitled: boolean; reason: "free" | "subscribed" | "paywall" }>
{
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status,current_period_end,price_id")
    .eq("user_id", attorneyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub) {
    const end = sub.current_period_end ? new Date(sub.current_period_end as string).getTime() : null;
    const future = end === null || end > Date.now();
    const status = sub.status as string;
    const priceId = sub.price_id as string | null;
    const attorneyPlans = new Set([
      "attorney_solo_monthly",
      "attorney_firm_monthly",
      "attorney_enterprise_monthly",
      // legacy price id used during The Pilot rollout
      "attorney_portal_monthly_297",
    ]);
    const active = (["active", "trialing", "past_due"].includes(status) && future)
      || (status === "canceled" && end !== null && end > Date.now());
    if (active && priceId && attorneyPlans.has(priceId)) {
      return { entitled: true, reason: "subscribed" };
    }
  }
  void clientId;
  return { entitled: false, reason: "paywall" };
}

export const getAttorneyEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ clientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const r = await isAttorneyEntitled(context.userId, data.clientId);
    return r;
  });

/**
 * Build a court-ready ZIP packet for a specific client (attorney-scoped).
 * Reuses the survivor exporter shape but scoped to one client via the admin client.
 */
function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
function sha256(buf: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(Buffer.from(buf as ArrayBuffer)).digest("hex");
}

export const generateAttorneyCourtPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      clientId: z.string().uuid(),
      includeAttorneyNotes: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ent = await isAttorneyEntitled(context.userId, data.clientId);
    if (!ent.entitled) return { ok: false as const, reason: "paywall" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorization: an active attorney_client_link must exist for this pair.
    // Billing entitlement alone does NOT authorize data access.
    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("id,status,include_all_incidents,include_all_evidence,include_patterns,scope_incidents,scope_evidence")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) return { ok: false as const, reason: "no-active-link" as const };

    const scopeIncidents = (link.scope_incidents as string[] | null) ?? [];
    const scopeEvidence = (link.scope_evidence as string[] | null) ?? [];
    const includeAllIncidents = link.include_all_incidents !== false;
    const includeAllEvidence = link.include_all_evidence !== false;
    const includePatterns = link.include_patterns !== false;

    const incidentsQuery = includeAllIncidents
      ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).is("deleted_at", null).order("date")
      : supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).in("id", scopeIncidents.length ? scopeIncidents : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null).order("date");
    const evidenceQuery = includeAllEvidence
      ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).is("deleted_at", null).order("date")
      : supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).in("id", scopeEvidence.length ? scopeEvidence : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null).order("date");

    const [incRes, evRes, commsRes, paRes, casesRes, flagsRes] = await Promise.all([
      incidentsQuery,
      evidenceQuery,
      includeAllIncidents
        ? supabaseAdmin.from("communications").select("*").eq("user_id", data.clientId).order("date")
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      includePatterns
        ? supabaseAdmin.from("pattern_analyses").select("analysis,created_at").eq("user_id", data.clientId).order("created_at", { ascending: false }).limit(1)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      supabaseAdmin.from("cases").select("*").eq("user_id", data.clientId).order("updated_at", { ascending: false }).limit(1),
      supabaseAdmin.from("escalation_flags").select("*").eq("user_id", data.clientId).order("created_at"),
    ]);
    const incidents = incRes.data ?? [];
    const evidence = evRes.data ?? [];
    const comms = commsRes.data ?? [];
    const latestAnalysis = paRes.data?.[0];
    const latestCase = casesRes.data?.[0];
    const flags = flagsRes.data ?? [];

    // Attorney-side enrichments (reviews + doc requests). Scoped to this attorney+client.
    const [reviewsRes, docReqRes] = await Promise.all([
      supabaseAdmin
        .from("attorney_evidence_reviews")
        .select("evidence_id,status,exhibit_label,notes,linked_incident_id")
        .eq("attorney_user_id", context.userId)
        .eq("client_user_id", data.clientId),
      supabaseAdmin
        .from("attorney_document_requests")
        .select("title,details,status,created_at,completed_at")
        .eq("attorney_user_id", context.userId)
        .eq("client_user_id", data.clientId)
        .order("created_at"),
    ]);
    const reviews = (reviewsRes.data ?? []) as Array<{ evidence_id: string; status: string; exhibit_label: string | null; notes: string | null; linked_incident_id: string | null }>;
    const docRequests = (docReqRes.data ?? []) as unknown as Array<Record<string, unknown>>;
    const reviewByEv = new Map(reviews.map((r) => [r.evidence_id, r]));

    // Attorney private notes — case-level + per-incident — only loaded if the toggle is on.
    let caseNote = "";
    let incidentNotes: Array<{ incident_id: string; note: string | null; flagged: boolean; reviewed: boolean }> = [];
    if (data.includeAttorneyNotes) {
      const [caseLinkRes, incNotesRes] = await Promise.all([
        supabaseAdmin
          .from("attorney_client_links")
          .select("attorney_case_notes")
          .eq("attorney_user_id", context.userId)
          .eq("client_user_id", data.clientId)
          .eq("status", "active")
          .maybeSingle(),
        supabaseAdmin
          .from("attorney_incident_notes")
          .select("incident_id,note,flagged,reviewed")
          .eq("attorney_user_id", context.userId)
          .eq("client_user_id", data.clientId),
      ]);
      caseNote = (caseLinkRes.data as { attorney_case_notes: string | null } | null)?.attorney_case_notes ?? "";
      incidentNotes = (incNotesRes.data ?? []) as typeof incidentNotes;
    }

    const zip = new JSZip();
    const exportedAt = new Date().toISOString();
    const fileHashes: Array<{ path: string; sha256: string; bytes: number }> = [];

    zip.file("incidents.csv", toCsv(incidents as Array<Record<string, unknown>>));
    zip.file("evidence.csv", toCsv(evidence as Array<Record<string, unknown>>));
    zip.file("communications.csv", toCsv(comms as Array<Record<string, unknown>>));
    zip.file("escalation_flags.csv", toCsv(flags as Array<Record<string, unknown>>));
    if (latestAnalysis) zip.file("pattern_analysis.json", JSON.stringify(latestAnalysis, null, 2));
    if (latestCase) zip.file("case.json", JSON.stringify(latestCase, null, 2));

    const evFolder = zip.folder("evidence");
    await Promise.all(evidence.map(async (e: any) => {
      if (!evFolder) return;
      if (/^https?:\/\//i.test(e.file_url)) return;
      const { data: blob } = await supabaseAdmin.storage.from("evidence-files").download(e.file_url);
      if (!blob) return;
      const buf = await blob.arrayBuffer();
      const ext = String(e.file_url).split(".").pop() || "bin";
      const safe = `${e.date}_${String(e.id).slice(0, 8)}_${String(e.title).replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}.${ext}`;
      evFolder.file(safe, buf);
      const h = sha256(buf);
      fileHashes.push({ path: `evidence/${safe}`, sha256: h, bytes: buf.byteLength });
    }));

    const caseLabel = (latestCase as any)?.case_type ?? "Case file";
    const otherParty = (latestCase as any)?.other_party ?? "—";
    const jurisdiction = (latestCase as any)?.jurisdiction ?? "—";
    const caseShort = data.clientId.slice(0, 8).toUpperCase();

    // 00_cover.md
    zip.file("00_cover.md", [
      `# Court Packet`,
      ``,
      `**Case:** ${caseLabel}`,
      `**Client ref:** ${caseShort}`,
      `**Opposing party:** ${otherParty}`,
      `**Jurisdiction:** ${jurisdiction}`,
      ``,
      `**Prepared:** ${exportedAt}`,
      `**Attorney ref:** ${context.userId.slice(0, 8).toUpperCase()}`,
      ``,
      `---`,
      ``,
      `This packet has been compiled from the survivor's documented record. All`,
      `evidence files included in the /evidence directory are hashed in manifest.json`,
      `for chain-of-custody verification.`,
    ].join("\n"));

    // 01_table_of_contents.md
    const toc = [
      `# Table of Contents`,
      ``,
      `1. Cover — 00_cover.md`,
      `2. Pattern summary — 02_pattern_summary.md`,
      `3. Incident timeline — 03_timeline.md`,
      `4. Escalation flags — 04_escalation.md`,
      `5. Evidence index — 05_evidence_index.csv`,
      `6. Exhibit list — 06_exhibit_list.md`,
      `7. Legal correspondence — legal/doc_requests.csv`,
    ];
    if (data.includeAttorneyNotes) toc.push(`8. Attorney notes — 07_attorney_notes.md`);
    toc.push(``, `Raw data: incidents.csv, evidence.csv, communications.csv, escalation_flags.csv`);
    toc.push(`Manifest: manifest.json (SHA-256 hashes for every evidence file)`);
    zip.file("01_table_of_contents.md", toc.join("\n"));

    // 02_pattern_summary.md
    const patternLines: string[] = [`# Pattern Summary`, ``];
    if (latestAnalysis) {
      const a = (latestAnalysis as any).analysis as any;
      patternLines.push(`_Generated: ${(latestAnalysis as any).created_at}_`, ``);
      if (a?.pattern_summary) patternLines.push(`## Overview`, ``, a.pattern_summary, ``);
      if (a?.escalation_arc) patternLines.push(`## Escalation arc`, ``, a.escalation_arc, ``);
      if (Array.isArray(a?.behavior_categories)) {
        patternLines.push(`## Behavior categories`, ``);
        a.behavior_categories.forEach((c: any) => patternLines.push(`- **${c.name ?? c.category ?? "—"}** — ${c.count ?? c.frequency ?? ""} ${c.description ?? ""}`.trim()));
        patternLines.push(``);
      }
    } else {
      patternLines.push(`_No pattern analysis on file._`);
    }
    zip.file("02_pattern_summary.md", patternLines.join("\n"));

    // 03_timeline.md grouped by month
    const byMonth = new Map<string, any[]>();
    (incidents as any[]).forEach((i) => {
      const m = String(i.date ?? "").slice(0, 7) || "undated";
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(i);
    });
    const months = Array.from(byMonth.keys()).sort();
    const tl: string[] = [`# Incident Timeline`, ``, `${incidents.length} incidents on file.`, ``];
    months.forEach((m) => {
      tl.push(`## ${m}`, ``);
      byMonth.get(m)!.forEach((i: any) => {
        const types = Array.isArray(i.abuse_types) ? i.abuse_types.join(", ") : "";
        tl.push(`- **${i.date}${i.time ? " " + i.time : ""}** — ${i.location ?? ""}${types ? ` _(${types})_` : ""}`);
        if (i.description) tl.push(`  - ${String(i.description).replace(/\n+/g, " ")}`);
        if (i.witnesses) tl.push(`  - _Witnesses:_ ${i.witnesses}`);
      });
      tl.push(``);
    });
    zip.file("03_timeline.md", tl.join("\n"));

    // 04_escalation.md
    const esc: string[] = [`# Escalation Flags`, ``, `${flags.length} flags raised.`, ``];
    (flags as any[]).forEach((f) => {
      esc.push(`- **${f.created_at?.slice(0, 10) ?? ""}** — ${f.severity ?? "flag"}: ${f.summary ?? f.description ?? ""}`);
    });
    zip.file("04_escalation.md", esc.join("\n"));

    // 05_evidence_index.csv with attorney review metadata + exhibit labels
    const evIndexRows = (evidence as any[]).map((e) => {
      const r = reviewByEv.get(e.id);
      return {
        exhibit_label: r?.exhibit_label ?? "",
        date: e.date ?? "",
        title: e.title ?? "",
        file_type: e.file_type ?? "",
        review_status: r?.status ?? "unreviewed",
        linked_incident_id: r?.linked_incident_id ?? e.linked_incident_id ?? "",
        description: e.description ?? "",
        evidence_id: e.id,
      };
    });
    zip.file("05_evidence_index.csv", toCsv(evIndexRows));

    // 06_exhibit_list.md (only items the attorney marked with an exhibit label or candidate status)
    const exhibits = (evidence as any[])
      .map((e) => ({ e, r: reviewByEv.get(e.id) }))
      .filter(({ r }) => r && (r.exhibit_label || r.status === "exhibit_candidate"))
      .sort((a, b) => String(a.r?.exhibit_label ?? "").localeCompare(String(b.r?.exhibit_label ?? "")));
    const exLines: string[] = [`# Exhibit List`, ``];
    if (exhibits.length === 0) {
      exLines.push(`_No exhibits tagged yet._`);
    } else {
      exhibits.forEach(({ e, r }) => {
        exLines.push(`### ${r?.exhibit_label || "Candidate"} — ${e.title ?? ""}`);
        exLines.push(`- **Date:** ${e.date ?? "—"}`);
        exLines.push(`- **Type:** ${e.file_type ?? "—"}`);
        if (e.description) exLines.push(`- **Description:** ${e.description}`);
        if (r?.linked_incident_id) exLines.push(`- **Tied to incident:** ${r.linked_incident_id}`);
        exLines.push(``);
      });
    }
    zip.file("06_exhibit_list.md", exLines.join("\n"));

    // legal/doc_requests.csv
    const legalFolder = zip.folder("legal");
    legalFolder?.file("doc_requests.csv", toCsv(docRequests));

    // time_summary.csv — attorney-logged time entries (billable + total)
    const { data: timeRows } = await supabaseAdmin
      .from("time_entries")
      .select("entry_date,minutes,billable,description,attorney_user_id,created_at")
      .eq("case_link_id", link.id)
      .order("entry_date", { ascending: true });
    const timeEntries = (timeRows ?? []) as Array<{ entry_date: string; minutes: number; billable: boolean; description: string; attorney_user_id: string; created_at: string }>;
    const totalMinutes = timeEntries.reduce((s, r) => s + (r.minutes ?? 0), 0);
    const billableMinutes = timeEntries.filter((r) => r.billable).reduce((s, r) => s + (r.minutes ?? 0), 0);
    const summaryRows: Array<Record<string, unknown>> = timeEntries.map((r) => ({
      entry_date: r.entry_date,
      minutes: r.minutes,
      hours: (r.minutes / 60).toFixed(2),
      billable: r.billable ? "yes" : "no",
      description: r.description,
      attorney_user_id: r.attorney_user_id,
      logged_at: r.created_at,
    }));
    summaryRows.push({
      entry_date: "TOTAL",
      minutes: totalMinutes,
      hours: (totalMinutes / 60).toFixed(2),
      billable: `billable: ${(billableMinutes / 60).toFixed(2)}h`,
      description: `${timeEntries.length} entries`,
      attorney_user_id: "",
      logged_at: "",
    });
    zip.file("time_summary.csv", toCsv(summaryRows));

    // 07_attorney_notes.md (optional)
    if (data.includeAttorneyNotes) {
      const notesLines: string[] = [`# Attorney Notes`, ``, `_For internal use only. Strip this file before filing or sharing._`, ``];

      notesLines.push(`## Case strategy`, ``);
      notesLines.push(caseNote.trim() ? caseNote : `_(none)_`, ``);

      const flaggedIncidentNotes = incidentNotes.filter((n) => (n.note && n.note.trim()) || n.flagged);
      notesLines.push(`## Incident notes (${flaggedIncidentNotes.length})`, ``);
      if (flaggedIncidentNotes.length === 0) {
        notesLines.push(`_(none)_`, ``);
      } else {
        flaggedIncidentNotes.forEach((n) => {
          const inc = (incidents as any[]).find((i) => i.id === n.incident_id);
          const date = inc?.date ?? "—";
          notesLines.push(`### ${date} — incident ${String(n.incident_id).slice(0, 8)}`);
          if (n.flagged) notesLines.push(`- **Flagged for follow-up**`);
          if (n.reviewed) notesLines.push(`- **Reviewed**`);
          if (inc?.description) notesLines.push(`- _Summary:_ ${String(inc.description).slice(0, 220)}`);
          if (n.note) notesLines.push(`- **Note:** ${n.note}`);
          notesLines.push(``);
        });
      }

      const evidenceNotes = reviews.filter((r) => r.notes);
      notesLines.push(`## Evidence notes (${evidenceNotes.length})`, ``);
      if (evidenceNotes.length === 0) {
        notesLines.push(`_(none)_`, ``);
      } else {
        evidenceNotes.forEach((r) => {
          const ev = (evidence as any[]).find((e) => e.id === r.evidence_id);
          notesLines.push(`### ${r.exhibit_label || ev?.title || r.evidence_id.slice(0, 8)}`);
          notesLines.push(`- **Status:** ${r.status}`);
          notesLines.push(`- **Note:** ${r.notes}`);
          notesLines.push(``);
        });
      }
      zip.file("07_attorney_notes.md", notesLines.join("\n"));
    }

    zip.file("manifest.json", JSON.stringify({
      exported_at: exportedAt,
      client_user_id: data.clientId,
      attorney_user_id: context.userId,
      counts: { incidents: incidents.length, evidence: evidence.length, communications: comms.length, escalation_flags: flags.length },
      file_hashes: fileHashes,
      include_attorney_notes: !!data.includeAttorneyNotes,
      exhibit_count: exhibits.length,
      doc_request_count: docRequests.length,
      generator: "PatternProof Attorney Court Packet v1",
    }, null, 2));

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const ts = exportedAt.replace(/[:.]/g, "-");
    const objectPath = `${context.userId}/court-packet-${data.clientId}-${ts}.zip`;
    const up = await supabaseAdmin.storage.from("exports").upload(objectPath, zipBuf, {
      contentType: "application/zip",
      upsert: false,
    });
    if (up.error) return { ok: false as const, reason: `upload-failed: ${up.error.message}` };
    const signed = await supabaseAdmin.storage.from("exports").createSignedUrl(objectPath, 60 * 60 * 24);
    if (!signed.data?.signedUrl) return { ok: false as const, reason: "sign-failed" as const };
    return {
      ok: true as const,
      url: signed.data.signedUrl,
      bytes: zipBuf.byteLength,
      filename: `court-packet-${data.clientId.slice(0, 8)}-${ts}.zip`,
    };
  });

/* ------------------------- Prepare for Clio ZIP ------------------------- */

export const generateClioPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ clientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ent = await isAttorneyEntitled(context.userId, data.clientId);
    if (!ent.entitled) return { ok: false as const, reason: "paywall" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link } = await supabaseAdmin
      .from("attorney_client_links")
      .select("status,include_all_incidents,include_all_evidence,scope_incidents,scope_evidence")
      .eq("attorney_user_id", context.userId)
      .eq("client_user_id", data.clientId)
      .eq("status", "active")
      .maybeSingle();
    if (!link) return { ok: false as const, reason: "no-active-link" as const };

    const includeAllIncidents = link.include_all_incidents !== false;
    const includeAllEvidence = link.include_all_evidence !== false;
    const scopeIncidents = (link.scope_incidents as string[] | null) ?? [];
    const scopeEvidence = (link.scope_evidence as string[] | null) ?? [];

    const incidentsQuery = includeAllIncidents
      ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).is("deleted_at", null).order("date")
      : supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).in("id", scopeIncidents.length ? scopeIncidents : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null).order("date");
    const evidenceQuery = includeAllEvidence
      ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).is("deleted_at", null).order("date")
      : supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).in("id", scopeEvidence.length ? scopeEvidence : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null).order("date");

    const [incRes, evRes, casesRes, reviewsRes, docReqRes, attorneyProfileRes] = await Promise.all([
      incidentsQuery,
      evidenceQuery,
      supabaseAdmin.from("cases").select("*").eq("user_id", data.clientId).order("updated_at", { ascending: false }).limit(1),
      supabaseAdmin
        .from("attorney_evidence_reviews")
        .select("evidence_id,status,exhibit_label,notes,linked_incident_id")
        .eq("attorney_user_id", context.userId)
        .eq("client_user_id", data.clientId),
      supabaseAdmin
        .from("attorney_document_requests")
        .select("title,details,status,created_at,completed_at")
        .eq("attorney_user_id", context.userId)
        .eq("client_user_id", data.clientId)
        .order("created_at"),
      supabaseAdmin.from("attorney_profiles").select("full_name,firm_name,email,bar_number,jurisdiction").eq("user_id", context.userId).maybeSingle(),
    ]);

    const incidents = (incRes.data ?? []) as Array<Record<string, unknown>>;
    const evidence = (evRes.data ?? []) as Array<Record<string, unknown>>;
    const latestCase = casesRes.data?.[0] as Record<string, unknown> | undefined;
    const reviews = (reviewsRes.data ?? []) as Array<{ evidence_id: string; status: string; exhibit_label: string | null; notes: string | null; linked_incident_id: string | null }>;
    const docRequests = (docReqRes.data ?? []) as Array<Record<string, unknown>>;
    const attorney = attorneyProfileRes.data as { full_name?: string; firm_name?: string; email?: string; bar_number?: string; jurisdiction?: string } | null;
    const reviewByEv = new Map(reviews.map((r) => [r.evidence_id, r]));

    const exportedAt = new Date().toISOString();
    const caseShort = data.clientId.slice(0, 8).toUpperCase();
    const matterName = `${(latestCase?.case_type as string) ?? "Family Law Matter"} — Client ${caseShort}`;
    const otherParty = (latestCase?.other_party as string) ?? "";
    const jurisdiction = (latestCase?.jurisdiction as string) ?? "";

    const zip = new JSZip();

    // README
    zip.file("README_clio_import.md", [
      `# Prepare for Clio — Import Package`,
      ``,
      `**Matter:** ${matterName}`,
      `**Prepared:** ${exportedAt}`,
      `**Source:** PatternProof attorney portal`,
      ``,
      `## How to import`,
      ``,
      `1. **Contacts** → Clio › Contacts › Import — upload \`contacts.csv\`.`,
      `2. **Matter** → Clio › Matters › New — use \`matter.csv\` for field mapping.`,
      `3. **Documents** → Open the matter in Clio › Documents › Upload — drag the entire \`/documents\` folder. Use \`documents.csv\` as the index.`,
      `4. **Tasks** → Clio › Tasks › Import — upload \`tasks.csv\`.`,
      `5. **Calendar / Notes** → \`events.csv\` lists each documented incident as a timestamped matter note.`,
      ``,
      `## What's included`,
      ``,
      `- ${incidents.length} incident notes`,
      `- ${evidence.length} evidence documents`,
      `- ${docRequests.length} pending document requests (as Clio Tasks)`,
      `- Contacts: client + opposing party${otherParty ? ` (${otherParty})` : ""}`,
      ``,
      `All evidence files are stored under \`/documents/\` with sanitized filenames.`,
      `The \`manifest.json\` records SHA-256 hashes for every file for chain-of-custody.`,
    ].join("\n"));

    // contacts.csv (Clio-friendly column names)
    const contacts = [
      {
        type: "Person",
        first_name: "Client",
        last_name: caseShort,
        company: "",
        email: "",
        phone: "",
        role: "Client",
        notes: `PatternProof client ref ${caseShort}`,
      },
    ];
    if (otherParty) {
      contacts.push({
        type: "Person",
        first_name: otherParty.split(" ")[0] ?? otherParty,
        last_name: otherParty.split(" ").slice(1).join(" "),
        company: "",
        email: "",
        phone: "",
        role: "Opposing Party",
        notes: (latestCase?.relationship_type as string) ?? "",
      });
    }
    zip.file("contacts.csv", toCsv(contacts));

    // matter.csv
    const matter = [{
      matter_description: matterName,
      practice_area: (latestCase?.case_type as string) ?? "Family Law",
      client_reference: caseShort,
      opposing_party: otherParty,
      jurisdiction,
      status: "Open",
      open_date: new Date().toISOString().slice(0, 10),
      responsible_attorney: attorney?.full_name ?? "",
      firm: attorney?.firm_name ?? "",
      summary: ((latestCase?.pattern_summary as string) ?? "").slice(0, 2000),
    }];
    zip.file("matter.csv", toCsv(matter));

    // events.csv — each incident as a matter note
    const events = incidents.map((i) => {
      const types = Array.isArray(i.abuse_types) ? (i.abuse_types as string[]).join(", ") : "";
      return {
        matter_reference: caseShort,
        date: (i.date as string) ?? "",
        time: (i.time as string) ?? "",
        category: types || "Incident",
        location: (i.location as string) ?? "",
        note: String(i.description ?? "").replace(/\s+/g, " ").slice(0, 4000),
        witnesses: (i.witnesses as string) ?? "",
        severity: (i.severity_level as number) ?? "",
        source_id: i.id as string,
      };
    });
    zip.file("events.csv", toCsv(events));

    // documents.csv — Clio Document index
    const docFolder = zip.folder("documents");
    const fileHashes: Array<{ path: string; sha256: string; bytes: number }> = [];
    const docRows: Array<Record<string, unknown>> = [];

    await Promise.all(evidence.map(async (e) => {
      const r = reviewByEv.get(e.id as string);
      const exhibit = r?.exhibit_label ?? "";
      const baseName = `${(e.date as string) ?? "undated"}_${String(e.id).slice(0, 8)}_${String(e.title ?? "evidence").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}`;
      let storedPath = "";
      if (docFolder && !/^https?:\/\//i.test(String(e.file_url))) {
        const { data: blob } = await supabaseAdmin.storage.from("evidence-files").download(String(e.file_url));
        if (blob) {
          const buf = await blob.arrayBuffer();
          const ext = String(e.file_url).split(".").pop() || "bin";
          storedPath = `documents/${baseName}.${ext}`;
          docFolder.file(`${baseName}.${ext}`, buf);
          fileHashes.push({ path: storedPath, sha256: sha256(buf), bytes: buf.byteLength });
        }
      }
      docRows.push({
        matter_reference: caseShort,
        document_name: exhibit ? `${exhibit} — ${e.title ?? ""}` : (e.title as string) ?? "",
        date: (e.date as string) ?? "",
        category: r?.status ?? "evidence",
        file_path: storedPath,
        description: (e.description as string) ?? "",
        source_url: /^https?:\/\//i.test(String(e.file_url)) ? String(e.file_url) : "",
        attorney_notes: r?.notes ?? "",
      });
    }));
    zip.file("documents.csv", toCsv(docRows));

    // tasks.csv — open doc requests + high-severity gaps as Clio tasks
    const taskRows: Array<Record<string, unknown>> = docRequests.map((d) => ({
      matter_reference: caseShort,
      task_name: d.title ?? "Document request",
      description: d.details ?? "",
      status: d.status ?? "open",
      created_at: d.created_at ?? "",
      due_date: "",
      priority: "Normal",
      assignee: attorney?.full_name ?? "",
    }));
    zip.file("tasks.csv", toCsv(taskRows));

    // manifest.json
    zip.file("manifest.json", JSON.stringify({
      exported_at: exportedAt,
      target_system: "Clio Manage",
      matter_reference: caseShort,
      counts: { incidents: incidents.length, evidence: evidence.length, documents_stored: fileHashes.length, doc_requests: docRequests.length, contacts: contacts.length },
      file_hashes: fileHashes,
      generator: "PatternProof Prepare-for-Clio v1",
    }, null, 2));

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const ts = exportedAt.replace(/[:.]/g, "-");
    const objectPath = `${context.userId}/clio-package-${data.clientId}-${ts}.zip`;
    const up = await supabaseAdmin.storage.from("exports").upload(objectPath, zipBuf, {
      contentType: "application/zip",
      upsert: false,
    });
    if (up.error) return { ok: false as const, reason: `upload-failed: ${up.error.message}` };
    const signed = await supabaseAdmin.storage.from("exports").createSignedUrl(objectPath, 60 * 60 * 24);
    if (!signed.data?.signedUrl) return { ok: false as const, reason: "sign-failed" as const };
    return {
      ok: true as const,
      url: signed.data.signedUrl,
      bytes: zipBuf.byteLength,
      filename: `clio-package-${caseShort}-${ts}.zip`,
      counts: { incidents: incidents.length, documents: fileHashes.length, tasks: taskRows.length, contacts: contacts.length },
    };
  });