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
            product_data: { name: "P4TTERN PR00F Court Ready — Pay What You Can" },
            unit_amount: data.amountInCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: "P4TTERN PR00F Court Ready — Pay What You Can" },
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
 * Entitlement: attorney needs an active P4TTERN PR00F attorney subscription.
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
      ? supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).order("date")
      : supabaseAdmin.from("incidents").select("*").eq("user_id", data.clientId).in("id", scopeIncidents.length ? scopeIncidents : ["00000000-0000-0000-0000-000000000000"]).order("date");
    const evidenceQuery = includeAllEvidence
      ? supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).order("date")
      : supabaseAdmin.from("evidence").select("*").eq("user_id", data.clientId).in("id", scopeEvidence.length ? scopeEvidence : ["00000000-0000-0000-0000-000000000000"]).order("date");

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

    // 07_attorney_notes.md (optional)
    if (data.includeAttorneyNotes) {
      const notesLines: string[] = [`# Attorney Notes`, ``, `_For internal use. Do not file without review._`, ``];
      reviews.filter((r) => r.notes).forEach((r) => {
        const ev = (evidence as any[]).find((e) => e.id === r.evidence_id);
        notesLines.push(`### ${r.exhibit_label || ev?.title || r.evidence_id.slice(0, 8)}`);
        notesLines.push(`- **Status:** ${r.status}`);
        notesLines.push(`- **Note:** ${r.notes}`);
        notesLines.push(``);
      });
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
      generator: "P4TTERN PR00F Attorney Court Packet v1",
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