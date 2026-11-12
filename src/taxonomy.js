/* Editorial browsing hierarchy; never a claim of genealogical or prompt lineage. */
window.JMLTaxonomy = (() => {
  const levels = ["Superfamily", "Family", "Type", "Subtype"];
  let selected = [],
    depth = 1,
    query = "",
    origin = "all",
    limit = 36,
    promptMode = "all";
  const expanded = new Set();
  const key = (path) => JSON.stringify(path);
  const prefix = (path, base) => base.every((v, i) => path[i] === v);
  function entries() {
    const mapping = DATA.taxonomy.mapping;
    const sources = DATA.source_reviews.items
      .filter((r) => !r.merged_into)
      .map((r) => ({
        key: "source:" + r.id,
        kind: "source",
        id: r.id,
        title: r.title,
        path: mapping["source:" + r.id],
        record: r,
      }));
    const archive = DATA.groups.map((g) => ({
      key: "archive:" + g.id,
      kind: "archive",
      id: g.id,
      title: g.title,
      path: mapping["archive:" + g.id],
      record: g,
    }));
    return [...sources, ...archive].filter((e) => e.path);
  }
  function usableText(text) {
    if (typeof text !== "string") return false;
    const t = text.trim();
    return (
      t.length >= 12 &&
      !/^(?:prompt\s*)?(?:unknown|unavailable|not (?:available|recovered|provided)|to be (?:added|recovered)|placeholder|in preparation|tbd|n\/a)[.!\s]*$/i.test(
        t,
      ) &&
      !/^[\s\[\]{}_.-]+$/.test(t)
    );
  }
  function promptInfo(e) {
    if (e.kind === "source") {
      const prompts = sourcePrompts(e.record).filter((p) => usableText(p.text));
      return prompts.length
        ? { available: true, kind: "source", label: "Author / source text" }
        : { available: false, kind: "unknown", label: "Prompt unavailable" };
    }
    const g = e.record,
      coverage = g.image_ids.map((id) => PC.get(id)).filter(Boolean);
    if (
      usableText(g.recorded_revised_prompt) ||
      (g.prompt_status === "exact" && usableText(g.prompt)) ||
      (g.user_original_scope !== "batch request" &&
        usableText(g.user_original_prompt))
    )
      return {
        available: true,
        kind: "recorded",
        label: "Recorded generation text",
      };
    if (
      coverage.some(
        (p) =>
          (p.source_options || []).some((t) => usableText(t.text)) ||
          (p.method_template_ids || []).some((id) => {
            const t = TM.get(id);
            return t && usableText(t.readable_text || t.text || t.prompt);
          }),
      )
    )
      return {
        available: true,
        kind: "template",
        label: "Linked source template",
      };
    if (coverage.some((p) => usableText(p.reconstruction?.prompt)))
      return {
        available: true,
        kind: "reconstructed",
        label: "New reconstruction",
      };
    return { available: false, kind: "unknown", label: "Prompt unavailable" };
  }
  function stats(rows) {
    const images = new Set(),
      kinds = {
        source: 0,
        recorded: 0,
        template: 0,
        reconstructed: 0,
        unknown: 0,
      };
    for (const e of rows) {
      kinds[promptInfo(e).kind]++;
      const samples =
        e.kind === "source"
          ? sourceSamples(e.record)
          : e.record.image_ids.map((id) => IM.get(id)).filter(Boolean);
      for (const im of samples) {
        const asset = im.original || im.preview;
        if (asset?.startsWith("assets/"))
          images.add(DATA.image_identity?.[asset] || asset);
      }
    }
    return {
      entries: rows.length,
      images: images.size,
      withPrompt: rows.length - kinds.unknown,
      withoutPrompt: kinds.unknown,
      kinds,
    };
  }
  function kpis(rows) {
    const s = stats(rows);
    return (
      '<section class="tax-kpis" aria-label="Statistics for current selection and filters">' +
      [
        ["Entries", s.entries, "Distinct source / archive records"],
        ["Unique images", s.images, "Shared pools and renditions counted once"],
        [
          "With usable prompt",
          s.withPrompt,
          "Source, recorded, linked or reconstructed text",
        ],
        [
          "Without prompt",
          s.withoutPrompt,
          "No usable text; placeholders excluded",
        ],
      ]
        .map(
          ([label, value, help]) =>
            '<div class="tax-kpi"><span>' +
            label +
            "</span><strong>" +
            value +
            "</strong><small>" +
            help +
            "</small></div>",
        )
        .join("") +
      '</section><details class="tax-stat-definitions"><summary>Prompt evidence: ' +
      s.kinds.source +
      " author/source · " +
      s.kinds.recorded +
      " recorded · " +
      s.kinds.template +
      " linked template · " +
      s.kinds.reconstructed +
      " reconstructed · " +
      s.kinds.unknown +
      " unknown</summary><p>Each entry is counted once, by its strongest available text. Source templates are not proof of the exact input used for an image. Reconstructed text is newly written guidance, never a recovered original. Counts reflect this branch, search, collection and prompt filters, across all results, not just the loaded cards. Unique images exclude hidden/unavailable images and deduplicate shared images and preview/original renditions. Separate source records sharing an image remain separate entries.</p></details>"
    );
  }
  function matches(e) {
    const text =
      e.kind === "source"
        ? sourceTextIndex(e.record) + " " + e.path.join(" ").toLowerCase()
        : [
            e.title,
            ...e.path,
            e.record.prompt,
            e.record.recorded_revised_prompt,
            ...e.record.image_ids.map((id) => IM.get(id)?.file),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
    return (
      (origin === "all" || e.kind === origin) &&
      (promptMode === "all" || promptInfo(e).available) &&
      query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .every((word) => text.includes(word))
    );
  }
  function thumbnail(e, used) {
    const candidates =
      e.kind === "source"
        ? sourceSamples(e.record).map(sourceImageUrl).filter(Boolean)
        : e.record.image_ids.map((id) => IM.get(id)?.preview).filter(Boolean);
    const image = used ? candidates.find((x) => !used.has(x)) : candidates[0];
    if (image && used) used.add(image);
    return image || "";
  }
  function picture(url, title) {
    return url
      ? '<img loading="lazy" src="' + esc(url) + '" alt="' + esc(title) + '">'
      : '<span class="tax-placeholder">Text reference</span>';
  }
  function branch(path, rows) {
    const count = rows.filter((e) => prefix(e.path, path)).length;
    const children = [
      ...new Set(
        rows
          .filter((e) => prefix(e.path, path))
          .map((e) => e.path[path.length])
          .filter(Boolean),
      ),
    ].sort();
    const active = key(path) === key(selected);
    const button =
      '<button class="tax-node' +
      (active ? " selected" : "") +
      '" data-tax-select="' +
      esc(key(path)) +
      '"' +
      (active ? ' aria-current="true"' : "") +
      "><span>" +
      esc(path.at(-1)) +
      "</span><small>" +
      count +
      "</small></button>";
    if (!children.length) return "<li>" + button + "</li>";
    const open = expanded.has(key(path)) || prefix(selected, path);
    return (
      '<li><details data-tax-expand="' +
      esc(key(path)) +
      '"' +
      (open ? " open" : "") +
      '><summary aria-label="Expand ' +
      esc(path.at(-1)) +
      '"><span aria-hidden="true">+</span></summary>' +
      button +
      "<ul>" +
      children.map((child) => branch([...path, child], rows)).join("") +
      "</ul></details></li>"
    );
  }
  function interleave(rows) {
    const source = rows.filter((e) => e.kind === "source"),
      archive = rows.filter((e) => e.kind === "archive");
    const output = [];
    while (source.length || archive.length) {
      if (source.length) output.push(source.shift());
      if (archive.length) output.push(archive.shift());
    }
    return output;
  }
  function branchCards(rows) {
    if (selected.length >= depth) return "";
    const groups = new Map();
    rows
      .filter((e) => prefix(e.path, selected))
      .forEach((e) => {
        const path = e.path.slice(0, depth),
          k = key(path);
        if (!groups.has(k)) groups.set(k, { path, rows: [] });
        groups.get(k).rows.push(e);
      });
    return [...groups.values()]
      .sort((a, b) => a.path.join().localeCompare(b.path.join()))
      .map(
        (g) =>
          '<button class="tax-branch-card" data-tax-select="' +
          esc(key(g.path)) +
          '"><strong>' +
          esc(g.path.at(-1)) +
          "</strong><span>" +
          g.rows.filter((e) => e.kind === "source").length +
          " source · " +
          g.rows.filter((e) => e.kind === "archive").length +
          " archived</span></button>",
      )
      .join("");
  }
  function cards(rows) {
    const usedPreviews = new Set(),
      scoped = rows.filter((e) => prefix(e.path, selected));
    // A shared example pool is one visual card, never falsely merged provenance.
    const groups = new Map();
    interleave(scoped).forEach((e) => {
      const pool = e.kind === "source" && e.record.sample_set_id;
      const k = pool ? "pool:" + pool : e.key;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
    return (
      [...groups.values()]
        .slice(0, limit)
        .map((group) => {
          const e = group[0],
            shared = group.length > 1,
            title = shared
              ? "Environmental sports typography · shared examples"
              : e.title;
          return (
            '<article class="tax-reference-card" data-origin="' +
            e.kind +
            '">' +
            picture(thumbnail(e, usedPreviews), title) +
            '<div class="tax-card-copy"><small>' +
            (shared
              ? "Shared family examples"
              : e.kind === "source"
                ? "Source template / reference"
                : "Archived example") +
            '</small><span class="tax-prompt-badge">' +
            esc(promptInfo(e).label) +
            "</span><h3>" +
            esc(title) +
            '</h3><p class="tax-reference-path">' +
            esc(e.path.slice(1).join(" › ")) +
            "</p>" +
            (shared
              ? "<p>One shared example pool; " +
                group.length +
                " distinct source posts. Per-series image membership is unverified.</p>"
              : "") +
            group
              .map(
                (item) =>
                  '<a class="back" href="#' +
                  (item.kind === "source" ? "source/" : "prompt/") +
                  encodeURIComponent(item.id) +
                  '">' +
                  esc(shared ? item.title : "Read prompt & provenance") +
                  " →</a>",
              )
              .join("") +
            "</div></article>"
          );
        })
        .join("") || '<p class="empty">No references match this branch.</p>'
    );
  }
  function render() {
    const rows = entries().filter(matches),
      all = entries();
    const scoped = rows.filter((e) => prefix(e.path, selected));
    const roots = [...new Set(rows.map((e) => e.path[0]))].sort();
    const p = DATA.display_policy || {};
    $("source-reviews").innerHTML =
      '<header class="sample-hero source-hero" id="source-library"><p class="eyebrow">Unified gallery v2 · KPI review</p><h1>One gallery, every visual idea</h1><p>Source references and archived examples now appear side by side at every level. Use the tree to narrow the same combined gallery, rather than switching collections.</p><div class="tax-disclosure"><strong>167 / 208 imported source images recovered</strong><span>41 still missing · 37 remain small renditions · 2 source images hidden by your content preference · 4 more temporarily withheld from publication</span></div><p class="minor">This is an editorial classification, not a claim of creative ancestry or shared generation prompts. Original categories, authors, exact prompts and source records remain attached to each reference.</p></header><div class="tax-controls"><label>Search across both collections<input id="taxonomy-search" class="search" type="search" placeholder="Try typography, animals, paper…" value="' +
      esc(query) +
      '"></label><label>Collection<select id="taxonomy-origin"><option value="all">All collections</option><option value="source"' +
      (origin === "source" ? " selected" : "") +
      '>Source references</option><option value="archive"' +
      (origin === "archive" ? " selected" : "") +
      '>Original archive</option></select></label><fieldset class="tax-prompt-filter"><legend>Prompt availability</legend><button type="button" data-prompt-mode="all" aria-pressed="' +
      (promptMode === "all") +
      '">All</button><button type="button" data-prompt-mode="available" aria-pressed="' +
      (promptMode === "available") +
      '">Has usable prompt</button></fieldset></div><fieldset class="tax-resolution"><legend>Taxonomy granularity</legend>' +
      levels
        .map(
          (label, i) =>
            '<button type="button" data-tax-depth="' +
            (i + 1) +
            '" aria-pressed="' +
            (depth === i + 1) +
            '">' +
            (i + 1) +
            " · " +
            label +
            "</button>",
        )
        .join("") +
      '<p>Choose how specific the landing cards are. This does not change image quality.</p></fieldset><nav class="tax-breadcrumbs" aria-label="Selected taxonomy branch"><button data-tax-select="[]">All ideas</button>' +
      selected
        .map(
          (s, i) =>
            '<span aria-hidden="true">›</span><button data-tax-select="' +
            esc(key(selected.slice(0, i + 1))) +
            '">' +
            esc(s) +
            "</button>",
        )
        .join("") +
      "</nav>" +
      kpis(scoped) +
      '<div class="tax-layout"><aside class="tax-tree"><details id="taxonomy-tree-panel" open><summary>Explore the tree <small>' +
      all.length +
      ' references</small></summary><p class="minor">Expand with +, select a name to filter.</p><ul aria-label="Visual taxonomy">' +
      roots.map((r) => branch([r], rows)).join("") +
      '</ul></details></aside><section class="tax-results"><div class="tax-results-heading"><div><p class="eyebrow">' +
      (selected.length >= depth
        ? "References in this branch"
        : levels[depth - 1] + " view") +
      "</p><h2>" +
      esc(selected.at(-1) || "All visual ideas") +
      '</h2><p role="status" aria-live="polite">' +
      scoped.length +
      " matching references · " +
      scoped.filter((e) => e.kind === "source").length +
      " source / " +
      scoped.filter((e) => e.kind === "archive").length +
      ' archive</p></div><button class="back" id="taxonomy-reset">Reset filters</button></div><details class="tax-refine" open><summary>Refine this branch · ' +
      levels[depth - 1] +
      '</summary><div class="tax-branch-options">' +
      branchCards(rows) +
      '</div></details><h3 class="tax-grid-label">Source references & archived examples, together</h3><p class="minor">These share a visual category, not necessarily a generation prompt. Open any card for its original evidence.</p><div class="tax-cards">' +
      cards(rows) +
      "</div>" +
      (scoped.length > limit
        ? '<button class="solid tax-load-more" id="taxonomy-more">Show more references</button>'
        : "") +
      "</section></div>";
    if ($("taxonomy-more"))
      $("taxonomy-more").onclick = () => {
        limit += 36;
        render();
      };
    $("taxonomy-origin").onchange = (e) => {
      limit = 36;
      origin = e.target.value;
      render();
    };
    $("taxonomy-search").oninput = (e) => {
      const start = e.target.selectionStart;
      query = e.target.value;
      limit = 36;
      render();
      const input = $("taxonomy-search");
      input.focus();
      input.setSelectionRange(start, start);
    };
    $("taxonomy-reset").onclick = () => {
      selected = [];
      limit = 36;
      query = "";
      origin = "all";
      depth = 1;
      promptMode = "all";
      expanded.clear();
      render();
    };
    $("source-reviews").onclick = (e) => {
      const select = e.target.closest("[data-tax-select]"),
        level = e.target.closest("[data-tax-depth]"),
        prompt = e.target.closest("[data-prompt-mode]");
      if (prompt) {
        promptMode = prompt.dataset.promptMode;
        limit = 36;
        render();
        return;
      }
      if (select) {
        selected = JSON.parse(select.dataset.taxSelect);
        limit = 36;
        for (let i = 1; i <= selected.length; i++)
          expanded.add(key(selected.slice(0, i)));
        depth = Math.min(4, selected.length + 1);
        render();
      } else if (level) {
        limit = 36;
        depth = Number(level.dataset.taxDepth);
        if (selected.length >= depth) selected = selected.slice(0, depth - 1);
        render();
      }
    };
    $("source-reviews")
      .querySelectorAll("[data-tax-expand]")
      .forEach((el) =>
        el.addEventListener("toggle", () => {
          const k = el.dataset.taxExpand;
          el.open ? expanded.add(k) : expanded.delete(k);
        }),
      );
  }
  return { render, entries, promptInfo, stats, usableText };
})();
