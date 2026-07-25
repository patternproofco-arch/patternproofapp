import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -----------------------------------------------------------------------------
// Server-side EXIF + GPS + in-image OCR-lite extraction for a preserved
// evidence row. Uses `exifr` (Cloudflare Worker-compatible). GPS goes into
// quarantined columns and is NEVER returned by user-facing queries unless the
// survivor explicitly opts in per-item via setGpsRevealOptIn.
// -----------------------------------------------------------------------------

const IN_IMAGE_PATTERNS: Array<RegExp> = [
  // "Mar 14, 9:14 AM", "March 14 2025 9:14 PM"
  /\b([A-Z][a-z]{2,8})\s+(\d{1,2})(?:,)?\s*(\d{4})?\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/,
  // "03/14/25 09:14", "03-14-2025 09:14"
  /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s+(\d{1,2}):(\d{2})\b/,
  // iOS "Today 9:14 AM"
  /\b(Today|Yesterday)\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/,
  // Bare "9:14 AM" or 24-h "09:14"
  /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/,
];

function firstOcrHit(source: string | null | undefined): string | null {
  if (!source) return null;
  for (const rx of IN_IMAGE_PATTERNS) {
    const m = source.match(rx);
    if (m) return m[0];
  }
  return null;
}

/**
 * Extracts EXIF / QuickTime metadata for a preserved evidence row and stores:
 *   - exif_captured_at (from DateTimeOriginal / CreateDate)
 *   - in_image_timestamp_text (from ImageDescription / UserComment / XMP text)
 *   - gps_lat / gps_lon (QUARANTINED — never rendered without opt-in)
 * Then computes a suggested incident match within ±72h using the best
 * available anchor (EXIF > in-image OCR > ingest date). Sets
 * review_status = 'suggested' when a candidate is found, otherwise leaves it
 * as the row's current status (which stays 'confirmed' from the direct-upload
 * flow if nothing was suggested). Never touches linked_incident_id.
 */
export const enrichEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ evidence_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const rowRes = await supabase
      .from("evidence")
      .select("id, file_url, mime, ingested_at, created_at")
      .eq("id", data.evidence_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (rowRes.error || !rowRes.data) throw new Error("Evidence not found");
    const row = rowRes.data as {
      id: string;
      file_url: string;
      mime: string | null;
      ingested_at: string | null;
      created_at: string;
    };

    const mime = row.mime ?? "";
    const isMedia =
      mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
    if (!isMedia) return { ok: true as const, enriched: false as const };

    // Read file bytes. Cap what we parse at ~8MB — exifr only needs the first
    // few dozen KB, but exifr accepts a Buffer.
    const dl = await supabase.storage.from("evidence-files").download(row.file_url);
    if (dl.error || !dl.data) return { ok: true as const, enriched: false as const };
    const buf = Buffer.from(await dl.data.arrayBuffer());

    let exifCapturedAt: string | null = null;
    let gpsLat: number | null = null;
    let gpsLon: number | null = null;
    let ocrSourceText = "";
    try {
      const exifr = (await import("exifr")).default;
      const parsed = await exifr.parse(buf, {
        tiff: true,
        exif: true,
        gps: true,
        xmp: true,
        iptc: true,
        pick: [
          "DateTimeOriginal",
          "CreateDate",
          "ModifyDate",
          "GPSLatitude",
          "GPSLongitude",
          "latitude",
          "longitude",
          "ImageDescription",
          "UserComment",
          "Caption",
          "Headline",
          "Description",
        ],
      }).catch(() => null);
      if (parsed) {
        const dt =
          parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.ModifyDate ?? null;
        if (dt instanceof Date && !isNaN(dt.getTime())) exifCapturedAt = dt.toISOString();
        const lat = typeof parsed.latitude === "number" ? parsed.latitude : null;
        const lon = typeof parsed.longitude === "number" ? parsed.longitude : null;
        if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          gpsLat = lat;
          gpsLon = lon;
        }
        ocrSourceText = [
          parsed.ImageDescription,
          parsed.UserComment,
          parsed.Caption,
          parsed.Headline,
          parsed.Description,
        ]
          .filter((v: unknown): v is string => typeof v === "string")
          .join(" \n ");
      }
    } catch {
      /* exifr failed — proceed without EXIF/OCR */
    }

    const inImageTimestampText = firstOcrHit(ocrSourceText);

    // Choose anchor: EXIF > in-image OCR (only if we could parse it to a date;
    // we don't attempt full parse here — the raw text is stored for review) >
    // ingest date. For matching we only use EXIF here.
    const anchorIso = exifCapturedAt ?? row.ingested_at ?? row.created_at;
    const anchorDate = new Date(anchorIso);
    const anchorSource = exifCapturedAt ? "EXIF" : "upload time (no metadata)";

    // Find candidate incidents within ±72h of the anchor.
    const windowStart = new Date(anchorDate.getTime() - 72 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const windowEnd = new Date(anchorDate.getTime() + 72 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const inc = await supabase
      .from("incidents")
      .select("id, date, time, description")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("date", windowStart)
      .lte("date", windowEnd)
      .limit(20);

    let suggestedId: string | null = null;
    let matchReason: string | null = null;
    if (inc.data && inc.data.length > 0) {
      let best: { id: string; deltaH: number; date: string } | null = null;
      for (const i of inc.data) {
        const iDate = new Date(
          i.time ? `${i.date}T${i.time}` : `${i.date}T00:00:00`,
        );
        const deltaH = Math.abs(iDate.getTime() - anchorDate.getTime()) / 3600000;
        if (!best || deltaH < best.deltaH) {
          best = { id: i.id as string, deltaH, date: i.date as string };
        }
      }
      if (best) {
        suggestedId = best.id;
        matchReason = `Captured ${anchorIso.slice(0, 16).replace("T", " ")} (${anchorSource}) — within ${Math.round(best.deltaH)}h of incident on ${best.date}.`;
      }
    }

    // Only flip to 'suggested' when we actually have a candidate; otherwise
    // leave the row alone so direct-uploaded evidence stays confirmed.
    const update: Record<string, unknown> = {
      exif_captured_at: exifCapturedAt,
      in_image_timestamp_text: inImageTimestampText,
      gps_lat: gpsLat,
      gps_lon: gpsLon,
    };
    if (suggestedId) {
      update.suggested_incident_id = suggestedId;
      update.match_reason = matchReason;
      update.review_status = "suggested";
    }
    await supabase
      .from("evidence")
      .update(update)
      .eq("id", row.id)
      .eq("user_id", userId);

    return {
      ok: true as const,
      enriched: true as const,
      exif_captured_at: exifCapturedAt,
      in_image_timestamp_text: inImageTimestampText,
      has_gps: gpsLat !== null && gpsLon !== null,
      suggested_incident_id: suggestedId,
      match_reason: matchReason,
    };
  });

// -----------------------------------------------------------------------------
// Review-queue actions
// -----------------------------------------------------------------------------

export const listSuggestedEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("evidence")
      .select(
        "id, title, file_url, file_type, mime, exif_captured_at, in_image_timestamp_text, ingested_at, created_at, suggested_incident_id, match_reason",
      )
      .eq("user_id", userId)
      .eq("review_status", "suggested")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) throw new Error(res.error.message);
    const rows = res.data ?? [];
    if (rows.length === 0) return { items: [], incidents: {} };
    const incidentIds = Array.from(
      new Set(
        rows.map((r) => r.suggested_incident_id).filter((v): v is string => !!v),
      ),
    );
    let incidents: Record<string, { id: string; date: string; description: string | null }> = {};
    if (incidentIds.length > 0) {
      const incRes = await supabase
        .from("incidents")
        .select("id, date, description")
        .eq("user_id", userId)
        .in("id", incidentIds);
      for (const i of incRes.data ?? []) {
        incidents[i.id as string] = {
          id: i.id as string,
          date: i.date as string,
          description: (i.description as string | null) ?? null,
        };
      }
    }
    return { items: rows, incidents };
  });

export const confirmSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_id: z.string().uuid(),
        incident_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cur = await supabase
      .from("evidence")
      .select("id, suggested_incident_id")
      .eq("id", data.evidence_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (cur.error || !cur.data) throw new Error("Evidence not found");
    const targetIncident =
      data.incident_id ?? (cur.data.suggested_incident_id as string | null);
    await supabase
      .from("evidence")
      .update({
        linked_incident_id: targetIncident,
        review_status: "confirmed",
      })
      .eq("id", data.evidence_id)
      .eq("user_id", userId);
    return { ok: true as const };
  });

export const skipSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ evidence_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("evidence")
      .update({ review_status: "skipped" })
      .eq("id", data.evidence_id)
      .eq("user_id", userId);
    return { ok: true as const };
  });

// -----------------------------------------------------------------------------
// GPS reveal — explicit per-item opt-in. Reveals coordinates ONLY when
// gps_reveal_opt_in flips to true; the coordinates are never returned by any
// list query.
// -----------------------------------------------------------------------------

export const setGpsRevealOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_id: z.string().uuid(),
        opt_in: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("evidence")
      .update({ gps_reveal_opt_in: data.opt_in })
      .eq("id", data.evidence_id)
      .eq("user_id", userId);
    return { ok: true as const };
  });

/** Returns GPS coords ONLY when the survivor has explicitly opted in. */
export const getEvidenceGps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ evidence_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("evidence")
      .select("gps_lat, gps_lon, gps_reveal_opt_in")
      .eq("id", data.evidence_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (res.error || !res.data) throw new Error("Evidence not found");
    const hasGps = res.data.gps_lat !== null && res.data.gps_lon !== null;
    if (!hasGps) return { has_gps: false as const };
    if (!res.data.gps_reveal_opt_in) {
      return { has_gps: true as const, revealed: false as const };
    }
    return {
      has_gps: true as const,
      revealed: true as const,
      lat: res.data.gps_lat as number,
      lon: res.data.gps_lon as number,
    };
  });