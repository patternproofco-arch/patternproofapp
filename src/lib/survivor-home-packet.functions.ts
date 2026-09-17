import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, max: number) {
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const c = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(c, size) <= max) line = c;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const downloadMyHomePacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [incR, evR, grantR, attR, caseR] = await Promise.all([
      supabaseAdmin.from("incidents").select("date,date_precision,description").eq("user_id", userId).is("deleted_at", null).order("date", { ascending: true }).limit(80),
      supabaseAdmin.from("evidence").select("title,date,file_type").eq("user_id", userId).is("deleted_at", null).order("date", { ascending: true }).limit(80),
      supabaseAdmin.from("advocate_client_links").select("id,status,expires_at,include_all_incidents,include_all_evidence,include_patterns,advocate_user_id").eq("client_user_id", userId),
      supabaseAdmin.from("attorney_client_links").select("id,status,expires_at,attorney_user_id").eq("client_user_id", userId),
      supabaseAdmin.from("cases").select("case_name,pattern_summary").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    let page = pdf.addPage([612, 792]);
    let y = 750;
    const ink = rgb(0.12, 0.14, 0.18);

    const line = (text: string, size = 11, face = font) => {
      for (const l of wrap(text, face, size, 520)) {
        if (y < 56) {
          page = pdf.addPage([612, 792]);
          y = 750;
        }
        page.drawText(l, { x: 46, y, size, font: face, color: ink });
        y -= size + 4;
      }
    };

    line("Professional-review packet", 16, bold);
    line(`Generated ${new Date().toISOString()} on the server. Not legal advice.`);
    y -= 8;
    const summary = caseR.data?.pattern_summary || caseR.data?.case_name || "No case summary written yet.";
    line("Case summary", 13, bold);
    line(String(summary));
    y -= 8;
    line(`Timeline entries: ${(incR.data ?? []).length}. Evidence files listed: ${(evR.data ?? []).length}.`);
    y -= 6;
    line("Timeline", 13, bold);
    for (const row of incR.data ?? []) line(`${row.date ?? "Date unknown"} — ${(row.description ?? "").slice(0, 280)}`);
    y -= 6;
    line("Evidence", 13, bold);
    for (const row of evR.data ?? []) line(`${row.date ?? "undated"} — ${row.title ?? "Untitled"} (${row.file_type ?? "file"})`);
    y -= 6;
    line("Active and recorded grants", 13, bold);
    const grants = [
      ...(grantR.data ?? []).map((g) => `Advocate grant ${g.id} · ${g.status}${g.expires_at ? ` · expires ${g.expires_at}` : ""}`),
      ...(attR.data ?? []).map((g) => `Attorney grant ${g.id} · ${g.status}${g.expires_at ? ` · expires ${g.expires_at}` : ""}`),
    ];
    if (!grants.length) line("No professional grants on this account.");
    else grants.forEach((g) => line(g));
    y -= 8;
    line("A downloaded copy cannot be retracted. Revoking a grant only stops future access inside PatternProof.");

    const bytes = await pdf.save();
    await supabaseAdmin.rpc("record_audit_event", {
      p_user_id: userId,
      p_event_type: "packet.downloaded_by_survivor",
      p_subject_kind: "home_packet",
      p_subject_id: userId,
      p_actor_kind: "survivor",
      p_actor_id: userId,
      p_meta: { incidents: (incR.data ?? []).length, evidence: (evR.data ?? []).length },
    });
    return { filename: `patternproof-packet-${new Date().toISOString().slice(0, 10)}.pdf`, base64: Buffer.from(bytes).toString("base64") };
  });
