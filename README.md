# JML Prompt Gallery · local review repository

This is the owner-approved public gallery. GitHub Pages serves the main branch root at https://biocool.github.io/jml-image-prompt-gallery/. The same code works from local files.

## Open the gallery

Extract **every ZIP part into the same parent folder**, merging the `JML-Prompt-Gallery-Repository` folders. Open `index.html` in Chrome, Edge, Firefox or Safari. No installation, build step, internet connection or web server is needed for the gallery. External source links need internet. A local server is optional: `python3 -m http.server 8000`.

If your unzip application makes a different enclosing folder for each ZIP, move the contents of each `JML-Prompt-Gallery-Repository` folder into one combined folder. Keep the nested asset directories unchanged. These are independent ZIP files, not binary archive fragments.

## Structure and incremental edits

- `index.html`: small page shell, not a bundled multi-megabyte application.
- `src/gallery.js`: formatted gallery UI logic.
- `src/gallery.css`: formatted responsive styles.
- `content/*.js`: readable, separately versioned data sections. JSON-compatible values assigned to `window.JML_DATA` so `file://` works without fetch restrictions. These are the canonical content, not generated duplicate copies.
- `assets/`: original available image files plus separately named recoveries. Existing assets are preserved byte-for-byte.
- `manifests/`: baseline asset hashes, current hashes, source availability and validation results.
- `tests/browser.cjs`: desktop/mobile browser regression tests.
- `tools/validate.py`: syntax, local asset reference and original-asset integrity checks.

Change the applicable content section or source file, run checks, review `git diff`, and commit just those changes. Do not regenerate or upload the complete HTML for a prompt or image update. Add new images to `assets/` and edit only the source record that uses them. No generated asset is silently substituted for a missing source example.

## Git

The delivery is a working source tree. A compact Git history bundle is delivered separately rather than repeating all binary assets inside `.git` in the ZIP parts. To restore its history after merging every part:

    git clone ../JML-Prompt-Gallery-History.bundle ../JML-Prompt-Gallery-With-History

The cloned repository contains the same final tracked files. Alternatively, use `git init`, `git add .`, and `git commit -m "Import reviewed gallery"` in the extracted folder. No remote is configured and no publication is performed.

## Validate

    python3 tools/validate.py

Requires Python 3 and Node.js; install Pillow if you also want image decode checks. Browser tests additionally require Playwright and Chromium. Set `CHROMIUM_PATH` if Chromium is installed elsewhere:

    node tests/browser.cjs

See `manifests/validation.json` and `manifests/browser-tests.json` for checks actually performed. Mobile tests use a narrow browser viewport, not a physical iPhone or Android device.

## Source fidelity and limitations

All original prompts, categories, credits and source URLs are retained. Reconstructed prompts remain explicitly distinguished from recorded original text. Source availability does not establish permission to reuse third-party images. Missing source records are retained, not deleted. The old missing social-sharing thumbnail is not a gallery image; its inactive metadata reference was removed from the page while historical content remains unchanged.

The original prompt-gallery delivery had **five ZIPs**. The separate content-planner delivery had **six ZIPs**. They are different packages, not a missing sixth gallery part. See `docs/ORIGINAL-DELIVERY.json`.

## This review

See `docs/REVIEW-SUMMARY.md` for recovered-image counts, preservation results and the precise limits of browser testing. There are 738 image asset files; all 688 previous files remain unchanged.

## Unified taxonomy update

See `docs/TAXONOMY-REVIEW.md`. The landing page now combines source references and all original archive groups in a four-level editorial hierarchy. Content exclusions affect display only; original files remain as backup. Run `node tests/taxonomy.cjs` with jsdom installed for DOM regression tests.

## Unified gallery v2 and KPI cards

See `docs/UNIFIED-KPI-REVIEW.md` for the corrected mixed-results browsing, persistent prompt filter, KPI definitions and verification. The visible release label is “Unified gallery v2 · KPI review”.

## Public deployment

Published from the approved unified v2/KPI review. All 420 previously public assets are preserved. Public assets total 725; the four files representing two user-excluded images, plus nine renditions of four temporarily withheld artworks, remain only in the local backup and are not newly published. Prior published source records and redirects are retained in `manifests/previous-public-source-records.json`.
