import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import JSZip from "jszip";
import { createHash } from "crypto";
import { z } from "zod";
import { buildPatternExport } from "@/lib/pattern-export";

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

/**
 * Build a comprehensive ZIP export of the user's entire case file:
 *   - manifest.json (export metadata + hashes)
 *   - narrative.md (plain-text chronology)
 *   - incidents.csv, evidence.csv, communications.csv, voice_notes.csv
 *   - pattern_analysis.json (most recent cached analysis, if any)
 *   - evidence/  (original files + sha256 sidecar)
 *   - voice-notes/  (audio files + transcripts)
 *
 * Uploaded to the private `exports` bucket under {userId}/{timestamp}.zip
 * and returned as a signed URL valid for 24 hours.
 */
export const generateExportZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      case_id: z.string().uuid().optional().nullable(),
      include_message_threads: z.boolean().optional(),
    }).partial().parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const requestedCaseId = data?.case_id ?? null;
    const includeThreads = data?.include_message_threads !== false;

    // Resolve which case (if any) to scope this export to. When the survivor
    // has more than one case and did not pick one, we export ALL data (legacy
    // behavior). When they picked one, we scope incidents/evidence/legal to
    // that case's attached IDs.
    let scopedCase: Record<string, unknown> | null = null;
    if (requestedCaseId) {
      const { data: c } = await supabase
        .from("cases")
        .select("*")
        .eq("id", requestedCaseId)
        .eq("user_id", userId)
        .maybeSingle();
      scopedCase = (c as Record<string, unknown> | null) ?? null;
      if (!scopedCase) return { ok: false as const, reason: "case-not-found" };
    }
    const scopedIncidentIds: string[] | null = scopedCase
      ? (((scopedCase.highlighted_incident_ids as string[] | null) ?? []))
      : null;
    const scopedEvidenceIds: string[] | null = scopedCase
      ? (((scopedCase.attached_evidence_ids as string[] | null) ?? []))
      : null;
    const scopedLegalIds: string[] | null = scopedCase
      ? (((scopedCase.legal_document_ids as string[] | null) ?? []))
      : null;
    const scopedThreadIds: string[] | null = scopedCase
      ? (((scopedCase.attached_thread_ids as string[] | null) ?? []))
      : null;

    const incQ = scopedIncidentIds
      ? (scopedIncidentIds.length
          ? supabase.from("incidents").select("*").eq("user_id", userId).in("id", scopedIncidentIds).is("deleted_at", null).order("date", { ascending: true })
          : Promise.resolve({ data: [] as unknown[] }))
      : supabase.from("incidents").select("*").eq("user_id", userId).is("deleted_at", null).order("date", { ascending: true });
    const evQ = scopedEvidenceIds
      ? (scopedEvidenceIds.length
          ? supabase.from("evidence").select("*").eq("user_id", userId).in("id", scopedEvidenceIds).is("deleted_at", null).neq("review_status", "suggested").order("date", { ascending: true })
          : Promise.resolve({ data: [] as unknown[] }))
      : supabase.from("evidence").select("*").eq("user_id", userId).is("deleted_at", null).neq("review_status", "suggested").order("date", { ascending: true });
    const ldQ = scopedLegalIds
      ? (scopedLegalIds.length
          ? supabase.from("legal_documents").select("*").eq("user_id", userId).in("id", scopedLegalIds)
          : Promise.resolve({ data: [] as unknown[] }))
      : supabase.from("legal_documents").select("*").eq("user_id", userId);

    const [incRes, evRes, commsRes, vnRes, ldRes, paRes, singleCaseRes] = await Promise.all([
      incQ,
      evQ,
      // Communications and voice notes aren't attached per-case; export all when unscoped.
      supabase.from("communications").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("voice_notes").select("*").eq("user_id", userId).order("date", { ascending: true }),
      ldQ,
      supabase.from("pattern_analyses").select("analysis,reviewed_status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      // Case metadata: use the scoped case if provided, else the most-recently-updated one (legacy).
      requestedCaseId
        ? Promise.resolve({ data: scopedCase ? [scopedCase] : [] as Record<string, unknown>[] })
        : supabase.from("cases").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1),
    ]);

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
      ? (((latestCase.case_name as string | null)?.trim() || (latestCase.other_party as string | null)?.trim() || "case"))
      : "case";
    const caseSlug = caseLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "case";

    // Fetch evidence_families to identify canonical rows for grouping.
    const familyIds = Array.from(new Set(evidence.map((e) => e.family_id).filter((v): v is string => !!v)));
    const familyCanonical = new Map<string, string>();
    if (familyIds.length > 0) {
      const famRes = await supabase
        .from("evidence_families")
        .select("id, canonical_evidence_id")
        .in("id", familyIds);
      for (const f of famRes.data ?? []) {
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

    // CSV exports
    zip.file("incidents.csv", toCsv(incidents as Array<Record<string, unknown>>));
    zip.file("evidence.csv", toCsv(evidenceCsvRows as Array<Record<string, unknown>>));
    zip.file("communications.csv", toCsv(comms as Array<Record<string, unknown>>));
    zip.file("voice_notes.csv", toCsv(voiceNotes as Array<Record<string, unknown>>));
    zip.file("legal_documents.csv", toCsv(legalDocs as Array<Record<string, unknown>>));

    // Pattern analysis JSON — survivor-review gated (rejected claims stripped).
    const gatedPattern = latestAnalysis
      ? buildPatternExport(latestAnalysis.analysis, (latestAnalysis as { reviewed_status?: unknown }).reviewed_status)
      : null;
    if (latestAnalysis && gatedPattern) {
      zip.file(
        "pattern_analysis.json",
        JSON.stringify({ generated: latestAnalysis.created_at, analysis: gatedPattern.redactedAnalysis }, null, 2),
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
      else lines.push("# Pattern analysis", "", "_No AI-suggested pattern content has been confirmed by the survivor for inclusion._", "");
    }
    lines.push("## Chronology", "");
    type ChronEntry = { date: string; kind: string; text: string };
    const chrono: ChronEntry[] = [
      ...incidents
        .filter((i): i is typeof i & { date: string } => !!i.date)
        .map((i) => ({ date: i.date, kind: "Incident", text: `[${(i.abuse_types ?? []).join(", ")}]${i.location ? ` at ${i.location}` : ""} — ${i.description}` })),
      ...comms.filter((c) => c.harassment_flag).map((c) => ({ date: c.date, kind: `Communication (${c.channel})`, text: `${c.direction}${c.from_party ? ` from ${c.from_party}` : ""}: ${c.content ?? ""}` })),
      ...evidence.map((e) => ({ date: e.date, kind: `Evidence (${e.file_type})`, text: `${e.title}${e.description ? ` — ${e.description}` : ""}` })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    for (const c of chrono) {
      lines.push(`### ${c.date} — ${c.kind}`, "", c.text, "");
    }
    zip.file("narrative.md", lines.join("\n"));

    // Download evidence files (parallel, modest concurrency)
    const downloadFile = async (bucket: string, path: string) => {
      const { data } = await supabase.storage.from(bucket).download(path);
      if (!data) return null;
      const buf = await data.arrayBuffer();
      return buf;
    };

    const evidenceFolder = zip.folder("evidence");
    const evidenceCustody: Array<{ id: string; title: string; date: string; linked_incident_id: string | null; uploaded_at: string; safe_name: string; original_path: string; bytes: number; sha256: string; family_id: string | null; is_canonical: boolean }> = [];
    await Promise.all(evidence.map(async (e) => {
      if (!evidenceFolder) return;
      const buf = await downloadFile("evidence-files", e.file_url);
      if (!buf) return;
      const ext = e.file_url.split(".").pop() || "bin";
      const safeName = `${e.date}_${e.id.slice(0, 8)}_${e.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}.${ext}`;
      evidenceFolder.file(safeName, buf);
      const hash = sha256(buf);
      evidenceFolder.file(`${safeName}.meta.json`, JSON.stringify({
        id: e.id, title: e.title, date: e.date, description: e.description,
        file_type: e.file_type, linked_incident_id: e.linked_incident_id,
        sha256: hash, original_path: e.file_url,
        family_id: e.family_id ?? null, is_canonical: isCanonical(e),
      }, null, 2));
      fileHashes.push({ path: `evidence/${safeName}`, sha256: hash, bytes: buf.byteLength });
      evidenceCustody.push({
        id: e.id, title: e.title, date: e.date, linked_incident_id: e.linked_incident_id ?? null,
        uploaded_at: e.created_at, safe_name: safeName, original_path: e.file_url,
        bytes: buf.byteLength, sha256: hash,
        family_id: e.family_id ?? null, is_canonical: isCanonical(e),
      });
    }));

    const vnFolder = zip.folder("voice-notes");
    await Promise.all(voiceNotes.map(async (n) => {
      if (!vnFolder) return;
      const buf = await downloadFile("voice-notes", n.audio_url);
      if (!buf) return;
      const safeName = `${n.date}_${n.id.slice(0, 8)}_${(n.title || "voice_note").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60)}.webm`;
      vnFolder.file(safeName, buf);
      const hash = sha256(buf);
      fileHashes.push({ path: `voice-notes/${safeName}`, sha256: hash, bytes: buf.byteLength });
      if (n.transcript) {
        vnFolder.file(`${safeName}.transcript.txt`, n.transcript);
      }
    }));

    // Imported message conversations: original screenshots + extracted text +
    // the full correction history, so nothing about provenance is lost.
    if (includeThreads) {
      const thQ = scopedThreadIds
        ? (scopedThreadIds.length
            ? supabase.from("message_threads").select("*").eq("user_id", userId).in("id", scopedThreadIds)
            : Promise.resolve({ data: [] as unknown[] }))
        : supabase.from("message_threads").select("*").eq("user_id", userId);
      const { data: thData } = await thQ;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const threads = (thData ?? []) as any[];
      const threadIds = threads.map((t) => t.id as string);
      if (threadIds.length) {
        const [msgRes, docRes] = await Promise.all([
          supabase.from("thread_messages").select("*").eq("user_id", userId).in("thread_id", threadIds).order("position", { ascending: true }),
          supabase.from("thread_source_documents").select("*").eq("user_id", userId).in("thread_id", threadIds).order("upload_index", { ascending: true }),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages = (msgRes.data ?? []) as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const docs = (docRes.data ?? []) as any[];
        const messageIds = messages.map((m) => m.id as string);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let corrections: any[] = [];
        if (messageIds.length) {
          const { data: corrData } = await supabase
            .from("thread_message_corrections")
            .select("*")
            .eq("user_id", userId)
            .in("message_id", messageIds)
            .order("created_at", { ascending: true });
          corrections = corrData ?? [];
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
            ].join("\n"),
          );

          const shotsFolder = mtFolder.folder("screenshots");
          await Promise.all(docs.map(async (d) => {
            if (!shotsFolder) return;
            const buf = await downloadFile("evidence-files", d.storage_path);
            if (!buf) return;
            const ext = String(d.storage_path).split(".").pop() || "png";
            const safeName = `${String(d.upload_index).padStart(3, "0")}_${String(d.id).slice(0, 8)}.${ext}`;
            shotsFolder.file(safeName, buf);
            const hash = sha256(buf);
            fileHashes.push({ path: `message-threads/screenshots/${safeName}`, sha256: hash, bytes: buf.byteLength });
            shotsFolder.file(`${safeName}.meta.json`, JSON.stringify({
              id: d.id, thread_id: d.thread_id, upload_index: d.upload_index,
              original_filename: d.original_filename, ocr_status: d.ocr_status,
              ocr_confidence: d.ocr_confidence, sha256: hash, original_path: d.storage_path,
            }, null, 2));
          }));
        }
      }
    }

    // Manifest
    // Hash-of-hashes — tamper-evident root for the whole evidence set
    const hashOfHashes = createHash("sha256")
      .update(fileHashes.map((f) => `${f.path}\t${f.sha256}\t${f.bytes}`).sort().join("\n"))
      .digest("hex");

    zip.file("manifest.json", JSON.stringify({
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
      hash_of_hashes: hashOfHashes,
      generator: "PatternProof Export v1",
      integrity_note: "Each file in evidence/ and voice-notes/ has a SHA-256 hash listed above. Re-hash any file with `shasum -a 256 <file>` to verify the stored bytes match the preserved version. A hash does not prove truth, authorship, creation date, or admissibility.",
      disclaimer: "PatternProof helps organize and preserve documentation for professional review. It does not determine admissibility, make legal findings, or replace professional judgment.",
    }, null, 2));

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
      "A SHA-256 hash proves that the stored bytes match the preserved version. It",
      "does not prove truth, authorship, creation date, or admissibility.",
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
        .map((c) => `| ${c.date} | ${c.title.replace(/\|/g, "\\|")} | \`evidence/${c.safe_name}\` | ${c.bytes} | \`${c.sha256}\` | ${c.family_id ? `\`${c.family_id.slice(0, 8)}\`` : "—"} | ${c.family_id ? (c.is_canonical ? "yes" : "no") : "—"} | ${c.linked_incident_id ?? "—"} | ${c.uploaded_at} |`),
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
          notes.push(`- Family \`${fid.slice(0, 8)}\`: ${members.length} files represent 1 underlying record — see canonical \`evidence/${canon.safe_name}\`.`);
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
    zip.file("chain-of-custody.md", "This file has been renamed to provenance-and-integrity.md. See that file for the same content and clearer language about what a SHA-256 hash does and does not prove.\n");

    // Verification helper — re-hashes every file and diffs against manifest.json
    const verifySh = `#!/usr/bin/env bash
# Verifies that every file in this archive matches the SHA-256 recorded in manifest.json.
# Usage: bash verify.sh
set -e
if ! command -v shasum >/dev/null 2>&1 && ! command -v sha256sum >/dev/null 2>&1; then
  echo "Need 'shasum' or 'sha256sum' installed." >&2; exit 1
fi
HASHER=$(command -v shasum >/dev/null 2>&1 && echo "shasum -a 256" || echo "sha256sum")
FAILED=0
CHECKED=0
python3 -c "import json,sys; [print(f['path']+chr(9)+f['sha256']) for f in json.load(open('manifest.json'))['file_hashes']]" \\
  | while IFS=$'\\t' read -r path expected; do
      if [ ! -f "$path" ]; then echo "MISSING  $path"; FAILED=$((FAILED+1)); continue; fi
      actual=$($HASHER "$path" | awk '{print $1}')
      if [ "$actual" = "$expected" ]; then
        echo "OK       $path"
      else
        echo "MISMATCH $path"; FAILED=$((FAILED+1))
      fi
      CHECKED=$((CHECKED+1))
    done
echo "Done."
`;
    zip.file("verify.sh", verifySh);

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });

    const ts = exportedAt.replace(/[:.]/g, "-");
    const fileStem = requestedCaseId
      ? `patternproof-professional-review-${caseSlug}-${ts}`
      : `patternproof-professional-review-${ts}`;
    const objectPath = `${userId}/${fileStem}.zip`;
    const up = await supabase.storage.from("exports").upload(objectPath, zipBuf, {
      contentType: "application/zip",
      upsert: false,
    });
    if (up.error) return { ok: false as const, reason: `upload-failed: ${up.error.message}` };

    const signed = await supabase.storage.from("exports").createSignedUrl(objectPath, 60 * 60 * 24);
    if (!signed.data?.signedUrl) return { ok: false as const, reason: "sign-failed" };

    return {
      ok: true as const,
      url: signed.data.signedUrl,
      bytes: zipBuf.byteLength,
      filename: `${fileStem}.zip`,
      counts: {
        incidents: incidents.length,
        evidence: evidence.length,
        communications: comms.length,
        voice_notes: voiceNotes.length,
        legal_documents: legalDocs.length,
      },
      case_id: requestedCaseId,
      case_label: latestCase ? caseLabel : null,
    };
  });