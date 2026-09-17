# Rebuild the survivor screens, then prove them on the live site

Two halves: first make the four main survivor screens look and read like the
locked paper-and-ink system, then publish and walk a real pilot case on
pattern-proof.tech from upload through to withdrawing access.

## 1. Rebuild the four screens

Same features and wording, reorganised around the binding stitch.

**Dashboard**
- Left-aligned opening line and short summary, no centred hero block.
- Counts (records, files, days covered) as plain mono figures on one ruled row,
  not tiles or badges. No progress percentages.
- One clear next action as the ink tab; everything else is a plain text link.

**Timeline**
- One vertical stitch with each entry as a flat plate clipped to it.
- Date certainty stays visible: solid edge for an exact date, dashed for
  approximate, dotted for unknown.
- Date, time and source label in mono above the entry text.
- Filters as small square controls in one row, not pills.

**Evidence**
- List of flat plates: file name, date, source, and what has been read out of
  it (text, transcript, none yet), each on its own ruled line.
- Upload area is a plain ruled rectangle with the ink tab, no dashed novelty
  styling.
- Review of extracted text and transcripts stays exactly where it is today.

**Case details**
- Sections stacked down the stitch: who it involves, what is included, who has
  access, and the packet.
- Access list shows each person, what they can see, and a plain "End access"
  link.

Across all four: no lavender, no gradients, no shadows, corners at 3px,
Newsreader headings, Source Sans body, mono for dates and IDs. Empty states
stay warm and specific.

## 2. Publish

Publish the current work plus the rebuild, then confirm the live site shows
the new look before walking anything.

## 3. Walk the pilot case on the live site

Using a clearly-labelled fictional survivor account (name and email marked as
a sample account so it is obvious in the data), on pattern-proof.tech:

1. Sign up, consent, finish onboarding.
2. Add two or three records, including one with an approximate date.
3. Upload a photo and an audio file; confirm the text read out of the photo and
   the transcript of the audio actually appear and are reviewable, not blank.
4. Check the timeline shows the records and files in the right order with the
   right date markings.
5. Build the packet, open the produced file, and confirm it is not empty and
   contains only what was selected.
6. Invite a fictional professional, confirm they see only what was shared.
7. Withdraw access; confirm the professional's view closes and the previously
   issued download link stops working.

I will report exactly what passed, what failed, and fix what is code-fixable.
Anything left unproven gets named plainly rather than glossed over.

## 4. Clean up and record

Remove or clearly retire the fictional pilot data afterwards, and update the
certification notes with evidence for each step.

## Technical notes

- Restyle is scoped through the existing `data-persona="survivor"` layer in
  `src/styles.css` plus layout changes in `dashboard.tsx`, `timeline.tsx`,
  `evidence.tsx` and `case.tsx`; no data or authorization logic changes.
- Live and preview share one database, so the pilot rows are real rows — they
  will carry an obvious sample marker and be cleaned up.
- Checks before and after: `bunx tsgo --noEmit`, `bunx vitest run`,
  `bun run build`, `bun run test:e2e`.
- Physical iPhone and Android testing is still not something I can do; that
  stays a human step and I will not claim otherwise.
