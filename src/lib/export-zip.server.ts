import { toSafeCsv } from "@/lib/csv-safe";
import JSZip from "jszip";
import { buildPatternExport } from "@/lib/pattern-export";
import {
  byDateAscNullsLast,
  selectAllPages,
  selectInChunks,
  selectInChunksPaged,
} from "@/lib/in-chunks.server";
import {
  addExportVerification,
  compareRecordedHash,
  ExportFileUnavailable,
  hashFileInventory,
  readExportFile,
  type IntegrityCheck,
} from "@/lib/export-integrity.server";

/**
 * Builds the survivor's full archive as ZIP bytes.
 *
 * Extracted from the download endpoint so the real archive can be produced and
 * opened in tests. The database client is passed in and every read is scoped to
 * the account; when a case is chosen, only what the account attached to that
 * case is included. Uploading and link-signing stay in export-zip.functions.ts.
 */

function toCsv(rows: Array<Record<string, unknown>>): string {
  return toSafeCsv(rows);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ExportCounts = {
  incidents: number;
  evidence: number;
  communications: number;
  voice_notes: number;
  legal_documents: number;
};

export type BuiltExport =
  | { ok: false; reason: string }
  | {
      ok: true;
      zipBuf: Uint8Array;
      fileStem: string;
      counts: ExportCounts;
      case_id: string | null;
      case_label: string | null;
      integrity_warning_count: number;
    };

export async function buildSurvivorExportZip(
  db: Db,
  args: { userId: string; caseId?: string | null; includeThreads?: boolean },
): Promise<BuiltExport> {
  try {
    return await buildArchive(db, args);
  } catch (error) {
    if (error instanceof ExportFileUnavailable) return { ok: false, reason: "file-unavailable" };
    throw error;
  }
}

async function buildArchive(
  db: Db,
  args: { userId: string; caseId?: string | null; includeThreads?: boolean },
): Promise<BuiltExport> {
  const userId = args.userId;
  const data = { case_id: args.caseId ?? null, include_message_threads: args.includeThreads };
  const requestedCaseId = data?.case_id ?? null;
  const includeThreads = data?.include_message_threads !== false;

  // Resolve which case (if any) to scope this export to. When the survivor
  // has more than one case and did not pick one, we export ALL data (legacy
  // behavior). When they picked one, we scope incidents/evidence/legal to
  // that case's attached IDs.
  let scopedCase: Record<string, unknown> | null = null;
  if (requestedCaseId) {
    const { data: c } = await db
      .from("cases")
      .select("*")
      .eq("id", requestedCaseId)
      .eq("user_id", userId)
      .maybeSingle();
    scopedCase = (c as Record<string, unknown> | null) ?? null;
    if (!scopedCase) return { ok: false as const, reason: "case-not-found" };
  }
  const scopedIncidentIds: string[] | null = scopedCase
    ? ((scopedCase.highlighted_incident_ids as string[] | null) ?? [])
    : null;
  const scopedEvidenceIds: string[] | null = scopedCase
    ? ((scopedCase.attached_evidence_ids as string[] | null) ?? [])
    : null;
  const scopedLegalIds: string[] | null = scopedCase
    ? ((scopedCase.legal_document_ids as string[] | null) ?? [])
    : null;
  const scopedThreadIds: string[] | null = scopedCase
    ? ((scopedCase.attached_thread_ids as string[] | null) ?? [])
    : null;

  const readOwned = (table: string, ids: string[] | null = null, column = "id", order = "id") => {
    const page = (chunk: string[] | null, from: number, to: number) => {
      let query = db.from(table).select("*").eq("user_id", userId);
      if (chunk) query = query.in(column, chunk);
      return query
        .order(order, { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
    };
    return ids === null
      ? selectAllPages((from, to) => page(null, from, to), { what: table })
      : selectInChunksPaged(ids, (chunk, from, to) => page(chunk, from, to), { what: table });
  };

  // Long id lists are read in batches and unscoped reads are paged: the API silently
  // caps one request at 1,000 rows and rejects very long id lists, so a plain select
  // exported a case short without any error. These throw instead of dropping rows.
  const incQ = (
    scopedIncidentIds
      ? selectInChunks<{ date?: string | null }>(
          scopedIncidentIds,
          (chunk) =>
            db
              .from("incidents")
              .select("*")
              .eq("user_id", userId)
              .in("id", chunk)
              .is("deleted_at", null)
              .order("date", { ascending: true }),
          { sort: byDateAscNullsLast, what: "incident" },
        )
      : selectAllPages(
          (from, to) =>
            db
              .from("incidents")
              .select("*")
              .eq("user_id", userId)
              .is("deleted_at", null)
              .order("date", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
          { what: "incident" },
        )
  ).then((rows) => ({ data: rows as unknown[] }));
  const evQ = (
    scopedEvidenceIds
      ? selectInChunks<{ date?: string | null }>(
          scopedEvidenceIds,
          (chunk) =>
            db
              .from("evidence")
              .select("*")
              .eq("user_id", userId)
              .in("id", chunk)
              .is("deleted_at", null)
              .neq("review_status", "suggested")
              .order("date", { ascending: true }),
          { sort: byDateAscNullsLast, what: "file" },
        )
      : selectAllPages(
          (from, to) =>
            db
              .from("evidence")
              .select("*")
              .eq("user_id", userId)
              .is("deleted_at", null)
              .neq("review_status", "suggested")
              .order("date", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
          { what: "file" },
        )
  ).then((rows) => ({ data: rows as unknown[] }));
  const ldQ = readOwned("legal_documents", scopedLegalIds).then((data) => ({ data }));

  const [incRes, evRes, commsRes, vnRes, ldRes, paRes, singleCaseRes] = await Promise.all([
    incQ,
    evQ,
    // Communications and voice notes aren't attached per-case; export all when unscoped.
    readOwned("communications", null, "id", "date").then((data) => ({ data })),
    readOwned("voice_notes", null, "id", "date").then((data) => ({ data })),
    ldQ,
    db
      .from("pattern_analyses")
      .select("analysis,reviewed_status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
    // Case metadata: use the scoped case if provided, else the most-recently-updated one (legacy).
    requestedCaseId
      ? Promise.resolve({ data: scopedCase ? [scopedCase] : ([] as Record<string, unknown>[]) })
      : db
          .from("cases")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1),
  ]);
  if (paRes.error || singleCaseRes.error)
    throw new Error("Could not read the export details. Please try again.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incidents = (incRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evidence = (evRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comms = (commsRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const voiceNotes = (vnRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legalDocs = (ldRes.data ?? []) as any[];
  const latestAnalysis = paRes.data?.[0];
  const latestCase = (singleCaseRes.data as Array<Record<string, unknown>> | null)?.[0];
  const caseLabel = latestCase
    ? (latestCase.case_name as string | null)?.trim() ||
      (latestCase.other_party as string | null)?.trim() ||
      "case"
    : "case";
  const caseSlug =
    caseLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "case";

  // Fetch evidence_families to identify canonical rows for grouping.
  const familyIds = Array.from(
    new Set(evidence.map((e) => e.family_id).filter((v): v is string => !!v)),
  );
  const familyCanonical = new Map<string, string>();
  if (familyIds.length > 0) {
    const families = await selectInChunksPaged<{
      id: string;
      canonical_evidence_id: string | null;
    }>(
      familyIds,
      (chunk, from, to) =>
        db
          .from("evidence_families")
          .select("id,canonical_evidence_id")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to),
      { what: "file families" },
    );
    for (const f of families) {
      if (f.canonical_evidence_id) familyCanonical.set(f.id, f.canonical_evidence_id);
    }
  }
  const isCanonical = (e: { id: string; family_id: string | null }) =>
    !e.family_id ? true : familyCanonical.get(e.family_id) === e.id;

  // Augment evidence CSV rows with family_id and is_canonical.
  // Strip quarantined GPS fields — location data is opt-in per-item in the
  // app and MUST NOT leak into any bulk export.
  const evidenceCsvRows = evidence.map((e) => {
    const { gps_lat: _lat, gps_lon: _lon, gps_reveal_opt_in: _opt, ...rest } = e;
    return {
      ...rest,
      family_id: e.family_id ?? null,
      is_canonical: isCanonical(e),
    };
  });

  const zip = new JSZip();
  const exportedAt = new Date().toISOString();
  const fileHashes: Array<{ path: string; sha256: string; bytes: number }> = [];
  const integrityChecks: IntegrityCheck[] = [];

  // CSV exports
  zip.file("incidents.csv", toCsv(incidents as Array<Record<string, unknown>>));
  zip.file("evidence.csv", toCsv(evidenceCsvRows as Array<Record<string, unknown>>));
  zip.file("communications.csv", toCsv(comms as Array<Record<string, unknown>>));
  zip.file("voice_notes.csv", toCsv(voiceNotes as Array<Record<string, unknown>>));
  zip.file("legal_documents.csv", toCsv(legalDocs as Array<Record<string, unknown>>));

  // Pattern analysis JSON — survivor-review gated (rejected claims stripped).
  const gatedPattern = latestAnalysis
    ? buildPatternExport(
        latestAnalysis.analysis,
        (latestAnalysis as { reviewed_status?: unknown }).reviewed_status,
      )
    : null;
  if (latestAnalysis && gatedPattern) {
    zip.file(
      "pattern_analysis.json",
      JSON.stringify(
        { generated: latestAnalysis.created_at, analysis: gatedPattern.redactedAnalysis },
        null,
        2,
      ),
    );
  }

  // Case overview JSON
  if (latestCase) {
    zip.file("case.json", JSON.stringify(latestCase, null, 2));
  }

  // Narrative markdown
  const lines: string[] = [
    "# Documentation Export",
    "",
    `Exported on ${exportedAt}.`,
    `Records included: ${incidents.length} incidents, ${evidence.length} evidence files, ${comms.length} communications, ${voiceNotes.length} voice notes, ${legalDocs.length} legal documents.`,
    "",
  ];
  if (gatedPattern) {
    if (gatedPattern.lines.length) lines.push("# Pattern analysis", "", ...gatedPattern.lines);
    else
      lines.push(
        "# Pattern analysis",
        "",
        "_No AI-suggested pattern content has been confirmed by the survivor for inclusion._",
        "",
      );
  }
  lines.push("## Chronology", "");
  type ChronEntry = { date: string; kind: string; text: string };
  const chrono: ChronEntry[] = [
    ...incidents
      .filter((i): i is typeof i & { date: string } => !!i.date)
      .map((i) => ({
        date: i.date,
        kind: "Incident",
        text: `[${(i.abuse_types ?? []).join(", ")}]${i.location ? ` at ${i.location}` : ""} — ${i.description}`,
      })),
    ...comms
      .filter((c) => c.harassment_flag)
      .map((c) => ({
        date: c.date,
        kind: `Communication (${c.channel})`,
        text: `${c.direction}${c.from_party ? ` from ${c.from_party}` : ""}: ${c.content ?? ""}`,
      })),
    ...evidence.map((e) => ({
      date: e.date,
      kind: `Evidence (${e.file_type})`,
      text: `${e.title}${e.description ? ` — ${e.description}` : ""}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  for (const c of chrono) {
    lines.push(`### ${c.date} — ${c.kind}`, "", c.text, "");
  }
  zip.file("narrative.md", lines.join("\n"));

  const evidenceFolder = zip.folder("evidence");
  const evidenceCustody: Array<{
    id: string;
    title: string;
    date: string;
    linked_incident_id: string | null;
    uploaded_at: string;
    safe_name: string;
    original_path: string;
    bytes: number;
    sha256: string;
    family_id: string | null;
    is_canonical: boolean;
  }> = [];
  await Promise.all(
    evidence.map(async (e) => {
      if (!evidenceFolder) return;
      const { buffer: buf, sha256: hash } = await readExportFile(db, "evidence-files", e.file_url);
      const ext = e.file_url.split(".").pop() || "bin";
      const safeName = `${e.date}_${e.id}_${e.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}.${ext}`;
      evidenceFolder.file(safeName, buf);
      const integrity = compareRecordedHash(`evidence/${safeName}`, e.sha256, hash);
      integrityChecks.push(integrity);
      evidenceFolder.file(
        `${safeName}.meta.json`,
        JSON.stringify(
          {
            id: e.id,
            title: e.title,
            date: e.date,
            description: e.description,
            file_type: e.file_type,
            linked_incident_id: e.linked_incident_id,
            sha256: hash,
            recorded_sha256: integrity.recorded_sha256,
            matches_recorded_hash: integrity.matches_recorded_hash,
            original_path: e.file_url,
            family_id: e.family_id ?? null,
            is_canonical: isCanonical(e),
          },
          null,
          2,
        ),
      );
      fileHashes.push({ path: `evidence/${safeName}`, sha256: hash, bytes: buf.byteLength });
      evidenceCustody.push({
        id: e.id,
        title: e.title,
        date: e.date,
        linked_incident_id: e.linked_incident_id ?? null,
        uploaded_at: e.created_at,
        safe_name: safeName,
        original_path: e.file_url,
        bytes: buf.byteLength,
        sha256: hash,
        family_id: e.family_id ?? null,
        is_canonical: isCanonical(e),
      });
    }),
  );

  const vnFolder = zip.folder("voice-notes");
  await Promise.all(
    voiceNotes.map(async (n) => {
      if (!vnFolder) return;
      const { buffer: buf, sha256: hash } = await readExportFile(db, "voice-notes", n.audio_url);
      const safeName = `${n.date}_${n.id}_${(n.title || "voice_note").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}.webm`;
      vnFolder.file(safeName, buf);
      fileHashes.push({ path: `voice-notes/${safeName}`, sha256: hash, bytes: buf.byteLength });
      integrityChecks.push(compareRecordedHash(`voice-notes/${safeName}`, n.sha256, hash));
      if (n.transcript) {
        vnFolder.file(`${safeName}.transcript.txt`, n.transcript);
      }
    }),
  );

  // Imported message conversations: original screenshots + extracted text +
  // the full correction history, so nothing about provenance is lost.
  if (includeThreads) {
    const thData = await readOwned("message_threads", scopedThreadIds);
    // Earlier imports stored AI summaries / flags / exhibit labels on the thread.
    // They are unverified characterisations, so they never leave in an export.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const threads = ((thData ?? []) as any[]).map(
      ({ summary: _s, attorney_summary: _a, flags: _f, exhibit_label: _e, ...rest }) => rest,
    );
    const threadIds = threads.map((t) => t.id as string);
    if (threadIds.length) {
      const [messagesAll, docRes] = await Promise.all([
        // A long chat is far more than one page: read every message, in order.
        selectInChunksPaged(
          threadIds,
          (chunk, from, to) =>
            db
              .from("thread_messages")
              .select("*")
              .eq("user_id", userId)
              .in("thread_id", chunk)
              .order("thread_id", { ascending: true })
              .order("position", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
          { what: "message" },
        ),
        readOwned("thread_source_documents", threadIds, "thread_id", "upload_index").then(
          (data) => ({ data }),
        ),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = messagesAll as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs = (docRes.data ?? []) as any[];
      const messageIds = messages.map((m) => m.id as string);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let corrections: any[] = [];
      if (messageIds.length) {
        // Thousands of message ids cannot go in one request; read the history in batches.
        corrections = await selectInChunksPaged(
          messageIds,
          (chunk, from, to) =>
            db
              .from("thread_message_corrections")
              .select("*")
              .eq("user_id", userId)
              .in("message_id", chunk)
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
          { what: "correction" },
        );
        corrections.sort((a, b) =>
          String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
        );
      }

      const mtFolder = zip.folder("message-threads");
      if (mtFolder) {
        mtFolder.file("threads.json", JSON.stringify(threads, null, 2));
        mtFolder.file("messages.json", JSON.stringify(messages, null, 2));
        mtFolder.file("messages.csv", toCsv(messages as Array<Record<string, unknown>>));
        mtFolder.file("corrections.json", JSON.stringify(corrections, null, 2));
        mtFolder.file(
          "README.txt",
          [
            "Imported message conversations",
            "",
            "These messages were read from screenshots uploaded by the account holder.",
            "Text recognition happened on their own device. Each field records whether it",
            "was extracted automatically or corrected by hand; corrections.json keeps the",
            "original extracted value alongside every correction — nothing is overwritten.",
            "The original screenshots are in the screenshots/ folder, hashed in manifest.json.",
            "Conversations added from an exported chat file (.txt/.zip) keep that file, unchanged,",
            "in original-exports/. Its .meta.json shows the fingerprint recorded when it was saved",
            "and whether the stored file still matches it. Read FILE-CHECKS.txt before using it.",
            "A matching fingerprint does not prove that the chat was untouched before import.",
          ].join("\n"),
        );

        const shotsFolder = mtFolder.folder("screenshots");
        const originalsFolder = mtFolder.folder("original-exports");
        await Promise.all(
          docs.map(async (d) => {
            // An exported chat file (.txt/.zip) lives in message-exports, not evidence-files.
            const isOriginalExport = d.kind === "chat_export";
            const folder = isOriginalExport ? originalsFolder : shotsFolder;
            const folderName = isOriginalExport ? "original-exports" : "screenshots";
            if (!folder) return;
            const { buffer: buf, sha256: hash } = await readExportFile(
              db,
              isOriginalExport ? "message-exports" : "evidence-files",
              d.storage_path,
            );
            const ext =
              String(d.storage_path).split(".").pop() || (isOriginalExport ? "txt" : "png");
            const safeName = `${String(d.upload_index).padStart(3, "0")}_${d.id}.${ext}`;
            folder.file(safeName, buf);
            const integrity = compareRecordedHash(
              `message-threads/${folderName}/${safeName}`,
              d.sha256,
              hash,
            );
            integrityChecks.push(integrity);
            fileHashes.push({
              path: `message-threads/${folderName}/${safeName}`,
              sha256: hash,
              bytes: buf.byteLength,
            });
            folder.file(
              `${safeName}.meta.json`,
              JSON.stringify(
                {
                  id: d.id,
                  thread_id: d.thread_id,
                  upload_index: d.upload_index,
                  original_filename: d.original_filename,
                  ocr_status: d.ocr_status,
                  ocr_confidence: d.ocr_confidence,
                  sha256: hash,
                  original_path: d.storage_path,
                  recorded_sha256: integrity.recorded_sha256,
                  matches_recorded_hash: integrity.matches_recorded_hash,
                },
                null,
                2,
              ),
            );
          }),
        );
      }
    }
  }

  const hashOfHashes = hashFileInventory(fileHashes);
  const manifest = {
    exported_at: exportedAt,
    user_id: userId,
    counts: {
      incidents: incidents.length,
      evidence: evidence.length,
      communications: comms.length,
      voice_notes: voiceNotes.length,
      legal_documents: legalDocs.length,
    },
    file_hashes: fileHashes,
    integrity_checks: integrityChecks,
    hash_of_hashes: hashOfHashes,
    generator: "PatternProof Export v1",
    integrity_note:
      "Exported originals are listed in file_hashes. archive_hashes also covers reports and metadata. integrity_checks compares each original with its saved fingerprint where available. The inventory is unsigned; a hash does not prove truth, authorship, creation date, or admissibility.",
    disclaimer:
      "PatternProof helps organize and preserve documentation for professional review. It does not determine admissibility, make legal findings, or replace professional judgment.",
  };

  // Provenance & integrity report (Markdown — renders cleanly in any viewer)
  const coc: string[] = [
    "# Provenance & Integrity Report",
    "",
    `**Export generated:** ${exportedAt}`,
    `**Custodian (account holder ID):** ${userId}`,
    `**Generator:** PatternProof Export v1`,
    `**Root hash (SHA-256 of all file hashes):** \`${hashOfHashes}\``,
    "",
    "This report lists the files exported from the account holder's PatternProof",
    "account at the timestamp above and their SHA-256 fingerprints. Re-compute the",
    "SHA-256 of any file in this archive (e.g. `shasum -a 256 <file>`) and confirm",
    "it matches the value recorded here and in `manifest.json`. Run `bash verify.sh`",
    "from the archive root to verify every file at once.",
    "",
    "Read FILE-CHECKS.txt for comparisons with fingerprints saved at import.",
    "Changed files are included with warnings; files with no saved fingerprint",
    "have not had their earlier history verified. This inventory is unsigned.",
    "These checks do not prove truth, authorship, creation date, or admissibility.",
    "",
    "**PatternProof helps organize and preserve documentation for professional",
    "review. It does not determine admissibility, make legal findings, or replace",
    "professional judgment.**",
    "",
    "## Evidence files",
    "",
    "Every uploaded file is listed and hash-verifiable. Files that share the",
    "same SHA-256 are grouped into a family — the earliest preserved copy is",
    "the canonical record; later byte-identical copies are duplicates of that",
    "record, not independent corroboration.",
    "",
    "| Date | Title | File | Bytes | SHA-256 | Family | Canonical | Linked incident | Uploaded |",
    "|------|-------|------|------:|---------|--------|-----------|-----------------|----------|",
    ...evidenceCustody
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (c) =>
          `| ${c.date} | ${c.title.replace(/\|/g, "\\|")} | \`evidence/${c.safe_name}\` | ${c.bytes} | \`${c.sha256}\` | ${c.family_id ? `\`${c.family_id.slice(0, 8)}\`` : "—"} | ${c.family_id ? (c.is_canonical ? "yes" : "no") : "—"} | ${c.linked_incident_id ?? "—"} | ${c.uploaded_at} |`,
      ),
    "",
    "### Duplicate groupings",
    "",
    ...(() => {
      const groups = new Map<string, typeof evidenceCustody>();
      for (const c of evidenceCustody) {
        if (!c.family_id) continue;
        const arr = groups.get(c.family_id) ?? [];
        arr.push(c);
        groups.set(c.family_id, arr);
      }
      const notes: string[] = [];
      for (const [fid, members] of groups) {
        if (members.length < 2) continue;
        const canon = members.find((m) => m.is_canonical) ?? members[0];
        notes.push(
          `- Family \`${fid.slice(0, 8)}\`: ${members.length} files represent 1 underlying record — see canonical \`evidence/${canon.safe_name}\`.`,
        );
      }
      return notes.length > 0 ? notes : ["_No duplicate groupings in this export._"];
    })(),
    "",
    "",
    "## Voice notes & other artifacts",
    "",
    "| Path | Bytes | SHA-256 |",
    "|------|------:|---------|",
    ...fileHashes
      .filter((f) => !f.path.startsWith("evidence/"))
      .map((f) => `| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` |`),
    "",
    "## Record counts",
    "",
    `- Incidents: ${incidents.length}`,
    `- Evidence files: ${evidence.length}`,
    `- Communications: ${comms.length}`,
    `- Voice notes: ${voiceNotes.length}`,
    `- Legal documents: ${legalDocs.length}`,
    "",
    "_End of report._",
    "",
  ];
  zip.file("provenance-and-integrity.md", coc.join("\n"));
  // Back-compat alias so older docs / attorneys expecting the previous filename still find it.
  zip.file(
    "chain-of-custody.md",
    "This file has been renamed to provenance-and-integrity.md. See that file for the same content and clearer language about what a SHA-256 hash does and does not prove.\n",
  );

  await addExportVerification(zip, manifest);

  const zipBuf = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const ts = exportedAt.replace(/[:.]/g, "-");
  const fileStem = requestedCaseId
    ? `patternproof-professional-review-${caseSlug}-${ts}`
    : `patternproof-professional-review-${ts}`;

  return {
    ok: true as const,
    zipBuf,
    fileStem,
    counts: {
      incidents: incidents.length,
      evidence: evidence.length,
      communications: comms.length,
      voice_notes: voiceNotes.length,
      legal_documents: legalDocs.length,
    },
    case_id: requestedCaseId,
    case_label: latestCase ? caseLabel : null,
    integrity_warning_count: integrityChecks.filter((f) => f.matches_recorded_hash === false)
      .length,
  };
}
