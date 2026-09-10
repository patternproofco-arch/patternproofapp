# Restyle the app screens, then prove the flows

Four asks in one message. One of them I can't do honestly, so I'm saying that up front and covering it a different way.

## What I can't do

I have no physical iPhone. I cannot "walk a real iPhone photo and audio upload" on a device. I can drive a simulated iOS Safari browser (real touch events, Safari user agent, Safari's audio/photo quirks in code), fix what that finds, and label the rest as still needing a human with a phone. I will not claim mobile is ready.

## 1. Restyle the app screens to the locked system

Same tokens, fonts, stitch, and rules already applied to the header and footer — now applied to the four screens you named, content included:

- Survivor dashboard
- Timeline
- Evidence
- Case details

Per screen: paper background, left-aligned content on the 48px binding stitch, Newsreader headings, Source Sans 3 body, IBM Plex Mono for dates/IDs, ink tab primary buttons, outlined secondary, 3px radius, no shadows. Date certainty keeps its stitch state: solid exact, dashed approximate, gap-and-tick unknown. No purple, no pills, no completion percentages.

Copy stays as it is. This is styling only.

## 2. Safari and mobile behaviour pass

Run the four screens plus photo and audio capture in a simulated iOS Safari and fix what is genuinely broken there:

- Photo upload from the camera roll: HEIC files, EXIF orientation, large files
- Audio capture: Safari records mp4, not webm — confirm the upload name and type match the bytes, or the transcript comes back empty
- Touch targets, safe-area insets, and the stitch layout at 393px wide

## 3. Walk the pilot case

On the live site, with clearly fictional accounts: upload a photo and an audio file, confirm the extracted text and the transcript are visible and reviewable rather than blank, build the packet, then revoke and confirm the old link stops working.

## 4. Advocate and organization portals

With separate fictional accounts — Advocate A, Organization A admin, Survivor A, Survivor B — prove:

- Survivor grants, advocate sees only the granted scope
- Organization membership alone never shows survivor evidence
- Narrowing and revoking scope closes access immediately, including previously issued download links
- Survivor B's records never appear to anyone unauthorised

Anything that fails gets fixed and gets a permanent test.

## Order

Restyle first (visible to you immediately), then Safari fixes, then the two live walkthroughs.

## Note on live testing

Test accounts write to the same backend as the live site. They will be clearly named as fictional and removed afterwards.
