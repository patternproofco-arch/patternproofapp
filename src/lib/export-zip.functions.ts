import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import JSZip from "jszip";
import { createHash } from "crypto";

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
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [incRes, evRes, commsRes, vnRes, ldRes, paRes, casesRes] = await Promise.all([
      supabase.from("incidents").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("evidence").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("communications").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("voice_notes").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("legal_documents").select("*").eq("user_id", userId),
      supabase.from("pattern_analyses").select("analysis,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      supabase.from("cases").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1),
    ]);

    const incidents = incRes.data ?? [];
    const evidence = evRes.data ?? [];
    const comms = commsRes.data ?? [];
    const voiceNotes = vnRes.data ?? [];
    const legalDocs = ldRes.data ?? [];
    const latestAnalysis = paRes.data?.[0];
    const latestCase = casesRes.data?.[0];

    const zip = new JSZip();
    const exportedAt = new Date().toISOString();
    const fileHashes: Array<{ path: string; sha256: string; bytes: number }> = [];

    // CSV exports
    zip.file("incidents.csv", toCsv(incidents as Array<Record<string, unknown>>));
    zip.file("evidence.csv", toCsv(evidence as Array<Record<string, unknown>>));
    zip.file("communications.csv", toCsv(comms as Array<Record<string, unknown>>));
    zip.file("voice_notes.csv", toCsv(voiceNotes as Array<Record<string, unknown>>));
    zip.file("legal_documents.csv", toCsv(legalDocs as Array<Record<string, unknown>>));

    // Pattern analysis JSON
    if (latestAnalysis) {
      zip.file("pattern_analysis.json", JSON.stringify({ generated: latestAnalysis.created_at, analysis: latestAnalysis.analysis }, null, 2));
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
    if (latestAnalysis) {
      const a = latestAnalysis.analysis as unknown as { pattern_summary?: string; escalation_arc?: string };
      lines.push("## Pattern summary", "", a?.pattern_summary ?? "", "", "## Escalation arc", "", a?.escalation_arc ?? "", "");
    }
    lines.push("## Chronology", "");
    type ChronEntry = { date: string; kind: string; text: string };
    const chrono: ChronEntry[] = [
      ...incidents.map((i) => ({ date: i.date, kind: "Incident", text: `[${(i.abuse_types ?? []).join(", ")}]${i.location ? ` at ${i.location}` : ""} — ${i.description}` })),
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
      }, null, 2));
      fileHashes.push({ path: `evidence/${safeName}`, sha256: hash, bytes: buf.byteLength });
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

    // Manifest
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
      generator: "PatternProof Export v1",
      integrity_note: "Each file in evidence/ and voice-notes/ has a SHA-256 hash listed above. Re-hash any file with `shasum -a 256 <file>` to verify it has not been altered since export.",
    }, null, 2));

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });

    const ts = exportedAt.replace(/[:.]/g, "-");
    const objectPath = `${userId}/patternproof-export-${ts}.zip`;
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
      filename: `patternproof-export-${ts}.zip`,
      counts: {
        incidents: incidents.length,
        evidence: evidence.length,
        communications: comms.length,
        voice_notes: voiceNotes.length,
        legal_documents: legalDocs.length,
      },
    };
  });