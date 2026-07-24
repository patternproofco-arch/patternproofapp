import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Court-Packet PDF export. Intentionally de-branded:
 *  - no PatternProof logo, gradient, thread-purple accent, or Newsreader.
 *  - Times-Roman serif + Courier mono only.
 *  - Exhibits numbered EXHIBIT 001, 002, ... on a standard index page.
 *  - Dates rendered as: confirmed = "Apr 12, 2025", approximate = "~ Apr 2025,
 *    anchored to: [note]", unknown = "Date unknown".
 *  - Returns { base64, filename } — client downloads.
 */

function fmtConfirmed(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}
function fmtApprox(range_start: string | null, range_end: string | null, anchor_label: string | null): string {
  const s = range_start ? new Date(range_start + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "";
  const e = range_end ? new Date(range_end + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "";
  const window = s && e && s !== e ? `${s} – ${e}` : s || e || "date approximate";
  const anchor = anchor_label ? `, anchored to: ${anchor_label}` : "";
  return `~ ${window}${anchor}`;
}
function dateLine(row: {
  date: string | null;
  date_precision: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  anchor_label: string | null;
}): string {
  const p = row.date_precision;
  if (p === "exact" && row.date) return fmtConfirmed(row.date);
  if (p === "approximate") return fmtApprox(row.date_range_start, row.date_range_end, row.anchor_label);
  if (row.date) return fmtConfirmed(row.date);
  return "Date unknown";
}

/** Wrap `text` to `maxWidth` at the given font/size in points. */
function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const generateCourtPacketPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ case_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ base64: string; filename: string }> => {
    const { supabase, userId } = context;

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("id,case_name,other_party,relationship_type,case_types,jurisdiction,pattern_summary,highlighted_incident_ids,attached_evidence_ids,legal_document_ids")
      .eq("id", data.case_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (caseErr || !caseRow) throw new Error("Case not found");

    const incIds: string[] = caseRow.highlighted_incident_ids ?? [];
    const evIds: string[] = caseRow.attached_evidence_ids ?? [];
    const lgIds: string[] = caseRow.legal_document_ids ?? [];

    const [incR, evR, lgR] = await Promise.all([
      incIds.length
        ? supabase.from("incidents").select("id,date,date_precision,date_range_start,date_range_end,anchor_label,location,description,abuse_types")
            .eq("user_id", userId).in("id", incIds).is("deleted_at", null)
        : Promise.resolve({ data: [] as unknown[] }),
      evIds.length
        ? supabase.from("evidence").select("id,title,date,file_type,description")
            .eq("user_id", userId).in("id", evIds).is("deleted_at", null)
        : Promise.resolve({ data: [] as unknown[] }),
      lgIds.length
        ? supabase.from("legal_documents").select("id,title,document_type,effective_date,incident_date,case_number,key_terms")
            .eq("user_id", userId).in("id", lgIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    interface Inc { id: string; date: string | null; date_precision: string | null; date_range_start: string | null; date_range_end: string | null; anchor_label: string | null; location: string | null; description: string; abuse_types: string[] }
    interface Ev { id: string; title: string; date: string | null; file_type: string; description: string | null }
    interface Lg { id: string; title: string; document_type: string; effective_date: string | null; incident_date: string | null; case_number: string | null; key_terms: string | null }

    const incidents = ((incR.data as Inc[] | null) ?? []).sort((a, b) => (a.date ?? "0") < (b.date ?? "0") ? -1 : 1);
    const evidence = (evR.data as Ev[] | null) ?? [];
    const legal = (lgR.data as Lg[] | null) ?? [];

    type Exhibit =
      | { kind: "incident"; row: Inc }
      | { kind: "evidence"; row: Ev }
      | { kind: "legal"; row: Lg };
    const exhibits: Exhibit[] = [
      ...incidents.map((row) => ({ kind: "incident" as const, row })),
      ...evidence.map((row) => ({ kind: "evidence" as const, row })),
      ...legal.map((row) => ({ kind: "legal" as const, row })),
    ];

    // ---------- Build PDF ----------
    const pdf = await PDFDocument.create();
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    const PAGE_W = 612, PAGE_H = 792; // US Letter
    const M = 72;                     // 1" margins
    const INK = rgb(0.08, 0.075, 0.12);
    const MUTE = rgb(0.35, 0.34, 0.38);

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - M;

    const writeLine = (text: string, font: import("pdf-lib").PDFFont, size: number, color = INK, indent = 0) => {
      if (y < M + size + 4) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - M;
      }
      page.drawText(text, { x: M + indent, y: y - size, size, font, color });
      y -= size + 4;
    };
    const writePara = (text: string, font: import("pdf-lib").PDFFont, size: number, color = INK) => {
      for (const l of wrap(text, font, size, PAGE_W - 2 * M)) writeLine(l, font, size, color);
    };
    const gap = (n = 12) => { y -= n; };
    const rule = () => {
      if (y < M + 20) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
      page.drawLine({
        start: { x: M, y }, end: { x: PAGE_W - M, y },
        thickness: 0.5, color: rgb(0.1, 0.1, 0.1),
      });
      y -= 12;
    };

    // ---------- Cover ----------
    writeLine("CASE PACKET", mono, 11, MUTE);
    gap(6);
    writeLine(caseRow.case_name || caseRow.other_party || "Untitled Case", serifBold, 22);
    gap(6);
    if (caseRow.other_party) writeLine(`Re: ${caseRow.other_party}`, serif, 12, MUTE);
    if (caseRow.jurisdiction) writeLine(`Jurisdiction: ${caseRow.jurisdiction}`, serif, 12, MUTE);
    if (caseRow.case_types?.length) writeLine(`Case type: ${caseRow.case_types.join(", ")}`, serif, 12, MUTE);
    writeLine(`Prepared: ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`, serif, 12, MUTE);
    gap(18);
    rule();
    writeLine("SUMMARY", mono, 10, MUTE);
    gap(4);
    if (caseRow.pattern_summary) writePara(caseRow.pattern_summary, serif, 12);
    else writePara("No summary provided.", serif, 12, MUTE);

    // ---------- Exhibit index ----------
    page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M;
    writeLine("EXHIBIT INDEX", serifBold, 16);
    gap(10);
    exhibits.forEach((e, i) => {
      const num = `EXHIBIT ${String(i + 1).padStart(3, "0")}`;
      let title = "";
      let dateStr = "";
      if (e.kind === "incident") {
        title = (e.row.description || "").trim().slice(0, 90) || "Incident";
        dateStr = dateLine(e.row);
      } else if (e.kind === "evidence") {
        title = e.row.title || "Evidence";
        dateStr = e.row.date ? fmtConfirmed(e.row.date) : "Date unknown";
      } else {
        title = e.row.title || "Document";
        dateStr = e.row.effective_date
          ? fmtConfirmed(e.row.effective_date)
          : e.row.incident_date
            ? fmtConfirmed(e.row.incident_date)
            : "Date unknown";
      }
      writeLine(`${num}    ${dateStr}`, mono, 10);
      writePara(`   ${title}`, serif, 12);
      gap(4);
    });

    // ---------- Chronology ----------
    page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M;
    writeLine("CHRONOLOGY", serifBold, 16);
    gap(10);
    if (!incidents.length) {
      writePara("No incidents included in this packet.", serif, 12, MUTE);
    } else {
      incidents.forEach((i, idx) => {
        writeLine(`EXHIBIT ${String(idx + 1).padStart(3, "0")}`, mono, 10, MUTE);
        writeLine(dateLine(i), mono, 11);
        if (i.location) writeLine(i.location, serif, 11, MUTE);
        gap(2);
        writePara(i.description || "(no description)", serif, 12);
        if (i.abuse_types?.length) writeLine(`Categories: ${i.abuse_types.join(", ")}`, mono, 9, MUTE);
        gap(10);
        rule();
      });
    }

    // ---------- Supporting evidence ----------
    if (evidence.length) {
      page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M;
      writeLine("SUPPORTING EVIDENCE", serifBold, 16);
      gap(10);
      evidence.forEach((e, idx) => {
        const num = incidents.length + idx + 1;
        writeLine(`EXHIBIT ${String(num).padStart(3, "0")}`, mono, 10, MUTE);
        writeLine(e.title || "Evidence", serifBold, 12);
        writeLine(`${e.date ? fmtConfirmed(e.date) : "Date unknown"} · ${e.file_type}`, mono, 10, MUTE);
        if (e.description) { gap(2); writePara(e.description, serif, 12); }
        gap(8);
        rule();
      });
    }

    // ---------- Legal documents ----------
    if (legal.length) {
      page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M;
      writeLine("LEGAL DOCUMENTS", serifBold, 16);
      gap(10);
      legal.forEach((l, idx) => {
        const num = incidents.length + evidence.length + idx + 1;
        writeLine(`EXHIBIT ${String(num).padStart(3, "0")}`, mono, 10, MUTE);
        writeLine(l.title || "Document", serifBold, 12);
        const d = l.effective_date || l.incident_date;
        writeLine(`${l.document_type.replace(/_/g, " ")}${l.case_number ? ` · Case #${l.case_number}` : ""}${d ? ` · ${fmtConfirmed(d)}` : ""}`, mono, 10, MUTE);
        if (l.key_terms) { gap(2); writePara(l.key_terms, serif, 12); }
        gap(8);
        rule();
      });
    }

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");
    const slug = (caseRow.case_name || caseRow.other_party || "case")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "case";
    return { base64, filename: `${slug}-court-packet.pdf` };
  });