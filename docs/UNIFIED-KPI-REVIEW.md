# Unified gallery v2 · KPI review

## What was wrong in the first hierarchy update

Although all 319 records were pooled, the interface initially showed only branch cards until a leaf was selected. Legacy collection labels also kept related techniques apart: only 3 of 24 families mixed sources and archive, and none of the 107 subtypes did. That did not make the two collections feel like one browsable gallery.

## What changed

- Real reference cards appear immediately at every level, not only at the leaves. The first page alternates 18 source references and 18 archived examples; Show more continues the same list.
- The tree and compact category buttons refine this same grid.
- Evidence-based shared style labels now combine 7 of 13 families, 12 of 48 types, and 17 of 74 subtypes. Unrelated styles are not forced together. Source/archived badges identify provenance, not separate sections.
- Sliced photographic letterforms, for example, now has 9 references together: 21 unique images, 8 entries with usable text and one without.

## KPI definitions and prompt filter

Four small cards reflect the current branch and all active search, collection and prompt filters, including unloaded results:

- Entries: distinct source or archived prompt records, counted once.
- Unique images: available images associated with those records. Shared pools, preview/original pairs and verified alternate renditions count once. Hidden and unavailable images are excluded.
- With usable prompt: an actual recorded prompt, author/source template, linked template, or explicitly labeled reconstruction exists.
- Without prompt: no usable text. Unknown labels and placeholders never qualify.

Initial totals: **319 entries; 437 unique visible images; 304 with usable prompt; 15 without**. Mutually exclusive evidence labels use the strongest available text per entry: 57 author/source records, 17 recorded generation texts, 32 linked templates, 198 reconstructions, 15 unknown. Source templates do not prove the exact text used for an image; reconstructions are not recovered originals.

The persistent All / Has usable prompt toggle applies at all four hierarchy levels and remains active during drilldown, granularity changes and search. Reset filters explicitly clears it. An empty branch shows zero KPIs and a useful empty message.

Sports remains two distinct sources sharing nine images, with no usable prompt. It shows one shared visual card with both links; under Has usable prompt it correctly produces no results.

## Preservation and verification

All previous canonical source/archive sections and all 738 asset files are unchanged. The 41 missing / 37 small-rendition disclosures remain; the two requested kissing/swimwear exclusions remain display-only, with originals retained as backup. No publication or push.

DOM tests cover immediate mixed results, shared subtype mixing, all KPI partitions, placeholder rejection, filter persistence through four levels, no-result states, all 73 source routes, all 247 archive routes and prior content exclusions. JavaScript syntax, image decode and asset checks pass. Real browser/mobile rendering remains unverified because this environment blocks Chromium's required process socket.
