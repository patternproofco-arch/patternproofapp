import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from "pdf-lib";
import { CLIENT_INVITATION_TEMPLATE } from "./attorney-offer";
import { KIT_QR_ROWS } from "./attorney-kit-qr";

export const FICTIONAL_TIMELINE = [
  {
    date: "2026-08-14",
    kind: "Client confirmed event date",
    certainty: "Exact, confirmed in this fictional example",
    note: "Client recorded a missed pickup at the agreed meeting point.",
    source: "Fictional note A, entered 2026-08-14",
  },
  {
    date: "2026-08-16",
    kind: "Message sent date",
    certainty: "Date shown in fictional message",
    note: "A message proposed a different pickup time. Client confirmed the entry.",
    source: "Fictional message B, sent 2026-08-16",
  },
] as const;

/** Self-contained fictional resources. Never queries cases, users, or storage. */
export async function buildAttorneyResource(sampleOnly = false) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    sampleOnly ? "PatternProof fictional chronology sample" : "PatternProof evidence intake kit",
  );
  pdf.setAuthor("PatternProof");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const heading = await pdf.embedFont(StandardFonts.TimesRoman);
  const ink = rgb(0.12, 0.18, 0.24);
  let page = pdf.addPage([612, 792]);
  let y = 710;
  function start(title: string, first = false) {
    if (!first) page = pdf.addPage([612, 792]);
    y = 708;
    page.drawText("PATTERNPROOF / ATTORNEY RESOURCES", {
      x: 48,
      y: 748,
      size: 10,
      font: bold,
      color: ink,
    });
    page.drawText(title, { x: 48, y, size: 25, font: heading, color: ink });
    y -= 36;
  }
  function paragraph(text: string, strong = false, size = 11) {
    const font = strong ? bold : regular;
    // Built-in PDF fonts do not support typographic punctuation.
    const safe = text.replace(/[—–]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
    for (const line of safe.split("\n")) {
      let buffer = "";
      for (const word of line.split(/\s+/)) {
        const next = buffer ? buffer + " " + word : word;
        if (font.widthOfTextAtSize(next, size) > 505 && buffer) {
          page.drawText(buffer, { x: 48, y, size, font, color: ink });
          y -= 17;
          buffer = word;
        } else buffer = next;
      }
      if (y < 85) throw new Error("Resource layout overflow");
      page.drawText(buffer, { x: 48, y, size, font, color: ink });
      y -= 17;
    }
    y -= 9;
  }
  function link(label: string, url: string) {
    paragraph(label, true);
    const annot = pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [48, y + 9, 560, y + 27],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    const annotations = page.node.lookup(PDFName.of("Annots"));
    if (!annotations)
      page.node.set(PDFName.of("Annots"), pdf.context.obj([pdf.context.register(annot)]));
  }
  if (!sampleOnly) {
    start("Evidence intake, with a path to the app", true);
    paragraph(
      "A manual worksheet for a client confirmed, source linked chronology. No client data is included in this kit.",
    );
    paragraph("Manual: gather sources, label dates, check context, and build a sequence.", true);
    paragraph(
      "In the app: preserve uploads, review suggested entries, confirm dates, and share a selected case. Processing support depends on file format. Review is still necessary; the app does not automate professional judgment.",
    );
    paragraph(
      "1. Keep the original before annotating or converting a file.\n2. Record what the date means: event, message sent, photo taken, or upload.\n3. Label uncertainty instead of guessing.\n4. Link each confirmed entry to its source.\n5. Keep observations distinct from interpretation.\n6. Let the client choose the scope before sharing.",
    );
    paragraph(
      "The app adds permission checks, original fingerprints, and source references. A PDF worksheet does not provide those access controls. Hashing does not certify authenticity or admissibility.",
    );
    link(
      "Explore the app and current first case offer",
      "https://pattern-proof.tech/for-attorneys",
    );
    paragraph("https://pattern-proof.tech/for-attorneys", false, 10);
    const cell = 2.6;
    KIT_QR_ROWS.forEach((row, r) =>
      [...row].forEach((v, c) => {
        if (v === "1")
          page.drawRectangle({
            x: 48 + c * cell,
            y: y - r * cell,
            width: cell,
            height: cell,
            color: ink,
          });
      }),
    );
    start("Your chronology worksheet");
    paragraph(
      "Use the same review steps in the app. Leave unknown dates unknown. Never use an upload date as the incident date.",
    );
    for (let i = 1; i <= 3; i++) {
      paragraph(`Entry ${i}`, true);
      paragraph(
        "Event date / range: _________________________________________\nDate meaning and certainty: __________________________________\nWhat the client observed: ____________________________________\nOriginal filename / source reference: ___________________________\nConfirmed / correct / reject / needs review: ______________________\nWho supplied it and when: ____________________________________",
        false,
        10,
      );
    }
  }
  start("Fictional chronology sample", sampleOnly);
  paragraph(
    "ILLUSTRATION ONLY. These are invented records. This is not a customer file, a testimonial, or a court filing.",
    true,
  );
  for (const entry of FICTIONAL_TIMELINE) {
    paragraph(entry.date + " / " + entry.kind, true);
    paragraph(entry.note + "\nDate certainty: " + entry.certainty + "\nSource: " + entry.source);
  }
  paragraph("Needs date review", true);
  paragraph(
    "Fictional photo C has no confirmed event date. It stays outside the dated sequence until reviewed. Its upload date would not establish when the pictured event happened.",
  );
  paragraph("Export review checklist", true);
  paragraph(
    "Check the shared scope, original source references, date labels, missing context, and file manifest. A SHA-256 fingerprint detects byte changes relative to that fingerprint. It does not establish who created the record or prove an allegation.",
  );
  link("Explore the fictional app walkthrough", "https://pattern-proof.tech/demo");
  if (!sampleOnly) {
    start("An invitation the client can choose");
    paragraph(CLIENT_INVITATION_TEMPLATE, false, 10);
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: 48, y: 59 }, end: { x: 564, y: 59 }, color: rgb(0.75, 0.75, 0.75) });
    p.drawText(`PatternProof | Manual companion to the app | ${i + 1} / ${pages.length}`, {
      x: 48,
      y: 43,
      font: regular,
      size: 9,
      color: ink,
    });
    p.drawText("pattern-proof.tech/for-attorneys | Review current access terms before sharing.", {
      x: 48,
      y: 29,
      font: regular,
      size: 8,
      color: ink,
    });
  });
  return pdf.save();
}
