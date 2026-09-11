import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { docxXmlToText, extractDocumentText, DOCX_MIME } from "@/lib/document-extract.server";

const enc = (s: string) => new TextEncoder().encode(s);

describe("document text extraction", () => {
  it("reads plain text files verbatim", async () => {
    const r = await extractDocumentText(enc("Line one\r\nLine two"), "text/plain", "note.txt");
    expect(r.status).toBe("ready");
    expect(r.method).toBe("plain");
    expect(r.text).toBe("Line one\nLine two");
  });

  it("reports an empty text file as empty rather than failed", async () => {
    const r = await extractDocumentText(enc("   "), "text/plain", "blank.txt");
    expect(r.status).toBe("empty");
  });

  it("turns Word paragraphs into one line each and decodes entities", () => {
    const xml =
      "<w:p><w:r><w:t>He said &quot;no&quot;</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>Then he left</w:t></w:r></w:p>";
    expect(docxXmlToText(xml)).toBe('He said "no"\nThen he left');
  });

  it("reads the body of a real Word file", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      "<w:document><w:body><w:p><w:r><w:t>Custody exchange note</w:t></w:r></w:p></w:body></w:document>",
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const r = await extractDocumentText(bytes, DOCX_MIME, "letter.docx");
    expect(r.status).toBe("ready");
    expect(r.method).toBe("docx");
    expect(r.text).toContain("Custody exchange note");
  });

  it("reads a real PDF text layer and keeps page markers", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([400, 400]);
    page.drawText("Order of protection filed on 3 March 2026 in county court", {
      x: 20,
      y: 350,
      size: 12,
      font,
    });
    const bytes = await doc.save();
    const r = await extractDocumentText(bytes, "application/pdf", "order.pdf");
    expect(r.status).toBe("ready");
    expect(r.method).toBe("pdf-text");
    expect(r.pages).toBe(1);
    expect(r.text).toContain("--- Page 1 ---");
    expect(r.text).toContain("Order of protection");
  });

  it("flags a PDF with no text layer for a reading pass instead of calling it blank", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const bytes = await doc.save();
    const r = await extractDocumentText(bytes, "application/pdf", "scan.pdf");
    expect(r.status).toBe("needs_ocr");
    expect(r.text).toBe("");
  });

  it("says plainly when a format cannot be read", async () => {
    const r = await extractDocumentText(enc("x"), "application/zip", "bundle.zip");
    expect(r.status).toBe("unsupported");
    expect(r.method).toBe("none");
  });
});

describe("photos and screenshots", () => {
  it("routes an image to the reading pass instead of calling it unsupported", async () => {
    const r = await extractDocumentText(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg", "shot.jpg");
    expect(r.status).toBe("needs_ocr");
  });

  it("treats an image as readable so both upload paths run extraction", async () => {
    const { isReadableDocument } = await import("@/lib/readable-documents");
    expect(isReadableDocument("image/png", "screenshot.png")).toBe(true);
    expect(isReadableDocument("image/heic", "IMG_0042.HEIC")).toBe(true);
  });
});
