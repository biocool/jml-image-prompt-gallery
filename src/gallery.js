"use strict";
const DATA = window.JMLVisibility.apply(window.JML_DATA),
  IM = new Map(DATA.images.map((x) => [x.id, x])),
  GR = new Map(DATA.groups.map((x) => [x.id, x])),
  CA = new Map(DATA.categories.map((x) => [x.id, x])),
  FA = new Map(DATA.families.map((x) => [x.id, x])),
  TM = new Map((DATA.source_templates || []).map((x) => [x.id, x])),
  PC = new Map((DATA.prompt_coverage?.items || []).map((x) => [x.image_id, x]));
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  num = (n) => new Intl.NumberFormat("en-US").format(n),
  json = (x) =>
    x == null
      ? "Not recovered."
      : typeof x === "object"
        ? JSON.stringify(x, null, 2)
        : String(x || "Not recovered.");
let family = "all",
  sub = "all",
  q = "",
  source = "all",
  homeY = 0,
  toastTimer,
  currentTab = "";
const revised = (g) =>
    g.recorded_revised_prompt ||
    (g.prompt_status === "exact" ? g.prompt : null),
  original = (g) => g.user_original_prompt,
  kind = (g) =>
    revised(g)
      ? "recorded_revised"
      : original(g) && g.user_original_scope !== "batch request"
        ? "user_original"
        : g.method_template_links?.length
          ? "method_template"
          : g.prompt_status === "source_brief"
            ? "source_brief"
            : "unknown";
function notice(s) {
  $("toast").textContent = s;
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.display = "none"), 2200);
}
async function copy(s) {
  if (!s) return false;
  try {
    await navigator.clipboard.writeText(s);
    notice("Copied");
    return true;
  } catch (e) {
    const t = document.createElement("textarea");
    t.value = s;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.append(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    notice(ok ? "Copied" : "Select the text and copy manually.");
    return ok;
  }
}
function oldBadge(g) {
  const k = kind(g);
  return (
    '<span class="badge ' +
    (["recorded_revised", "user_original"].includes(k)
      ? "verified"
      : "unknown") +
    '">' +
    {
      recorded_revised: "Recorded revised prompt",
      user_original: "User-original text",
      method_template: "Method-linked source template",
      source_brief:
        g.source_text_kind === "metadata"
          ? "Metadata only"
          : "Source brief only",
      unknown: "Prompt unknown",
    }[k] +
    "</span>"
  );
}
function badge(g) {
  const p = PC.get(g.image_ids[0]);
  if (!p) return oldBadge(g);
  const label = {
    recorded_generation_prompt: "Recorded generation prompt",
    method_linked_template: "Source template + reconstruction",
    visual_source_template: "Suggested source + reconstruction",
    reconstructed_from_image: "New reconstructed prompt",
    reconstructed_compositing_recipe: "New compositing recipe",
    not_ready: "Prompt in preparation",
  };
  return (
    '<span class="badge ' +
    (p.preferred_kind === "recorded_generation_prompt" ? "verified" : "") +
    '">' +
    esc(label[p.preferred_kind] || p.preferred_kind) +
    "</span>"
  );
}
function init() {
  const counts = {
    user_original: 0,
    recorded_revised: 0,
    method_template: 0,
    source_brief: 0,
    unknown: 0,
  };
  DATA.images.forEach((i) => counts[kind(i)]++);
  const originals = DATA.images.filter(original).length;
  $("recovery-status").innerHTML =
    "<strong>" +
    DATA.prompt_coverage.ready_count +
    ' / 247 images have usable instructions</strong><p>Recovered generation records take priority. Reusable source templates are linked where supported. New reconstructed prompts describe the image and are explicitly labeled, never passed off as originals.</p><div class="filter"><button class="back" id="download-ledger">Download image-by-image prompt ledger ↓</button><a class="back" href="#source-library">Browse additional source styles →</a></div><details><summary>Historical prompt recovery details</summary><div class="recovery-grid">' +
    [
      [
        "user_original",
        "User-original text",
        "Direct instructions without a revised record",
      ],
      [
        "recorded_revised",
        "Recorded revised prompt",
        "Verbatim generation record",
      ],
      [
        "method_template",
        "Method-linked template",
        "Current reusable source; historical version unproven",
      ],
      [
        "source_brief",
        "Brief / metadata only",
        "24 briefs + 5 palette/job metadata records",
      ],
      ["unknown", "Prompt unknown", "No reliable generation text recovered"],
    ]
      .filter(([k]) => k !== "user_original" || counts[k] > 0)
      .map(
        ([k, l, d]) =>
          "<div><b>" +
          num(counts[k]) +
          "</b><span>" +
          l +
          "</span><small>" +
          d +
          "</small></div>",
      )
      .join("") +
    "</div>" +
    '<p class="minor"><strong>' +
    DATA.images.filter((i) => i.association_confidence).length +
    " of 247 output sources traced.</strong> Source provenance does not mean its prompt text survived.</p>" +
    (originals
      ? '<p class="minor">No independent per-image user-original prompt has been recovered. ' +
        originals +
        " images have linked original user instructions. A shared batch request is labeled as a batch request, not a separate per-image prompt.</p>"
      : "");
  $("download-ledger").onclick = exportPromptLedger;
  $("stats").innerHTML = [
    ["247", "archive images"],
    [DATA.prompt_coverage.ready_count, "usable prompts"],
    [DATA.prompt_coverage.recorded_count, "recorded prompts"],
    [DATA.prompt_coverage.reconstructed_count, "new reconstructions"],
  ]
    .map(
      ([n, l]) =>
        '<div class="stat"><strong>' +
        num(n) +
        "</strong><span>" +
        l +
        "</span></div>",
    )
    .join("");
  $("taxonomy-count").textContent =
    DATA.families.length + " families / " + DATA.categories.length + " styles";
  const im = IM.get(151);
  $("interview").innerHTML =
    '<img src="' +
    im.preview +
    '" alt="A seated woman being interviewed in front of a phone camera"><span><strong>The woman being interviewed</strong><small>Open the image and its copyable prompt · Reconstruction labeled separately</small></span><span class="arrow">→</span>';
  $("interview").onclick = () => openGroup(im.group_id);
  $("styles").onclick = (e) => {
    const b = e.target.closest("[data-family]");
    if (b) {
      setFamily(b.dataset.family);
      $("subtypes").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  $("subtypes").onclick = (e) => {
    const b = e.target.closest("[data-sub]");
    if (b) {
      sub = b.dataset.sub;
      renderSubtypes();
      renderGrid();
      $("browse").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  $("search").oninput = (e) => {
    q = e.target.value;
    renderGrid();
  };
  $("sourcefilter").onchange = (e) => {
    source = e.target.value;
    renderGrid();
  };
  $("filters").onclick = (e) => {
    const b = e.target.closest("[data-family]");
    if (b) setFamily(b.dataset.family);
  };
  $("grid").onclick = (e) => {
    const b = e.target.closest("[data-group]");
    if (b) openGroup(b.dataset.group);
  };
  $("export").onclick = exportManifest;
  $("lightclose").onclick = () => $("lightbox").close();
  $("lightbox").onclick = (e) => {
    if (e.target === $("lightbox")) $("lightbox").close();
  };
  $("coverage").innerHTML = DATA.coverage?.length
    ? DATA.coverage
        .map((c) => '<div class="source-text">' + esc(json(c)) + "</div>")
        .join("")
    : '<p class="minor">The preserved archive, Prompt Library materials and accessible Central history have been checked. Missing original generation records remain explicit. A surviving source brief does not establish an exact generation call.</p>';
  renderSourceTemplates();
  renderSourceReviews();
  renderGeneratedExamples();
  renderArticleProjects();
  setFamily("all");
  route();
}
function renderSourceTemplates() {
  const ts = DATA.source_templates || [];
  if (!ts.length) return;
  const linked = ts.filter(
      (t) => t.source_kind === "current_canonical_template",
    ),
    other = ts.filter((t) => t.source_kind !== "current_canonical_template");
  $("source-templates").classList.remove("hidden");
  $("source-templates").innerHTML =
    (linked.length
      ? '<div class="section-title"><h2>Recorded method → source template</h2><small>' +
        linked.length +
        " reusable templates / " +
        DATA.images.filter((i) => i.method_template_links?.length).length +
        ' method-linked images</small></div><p class="minor">These jobs name a method that maps to a Prompt Library template. Browse the current reusable template and its method-linked images. The historical wrapper version and final generation wording remain unverified.</p><div class="subgrid" style="margin-top:16px">' +
        linked
          .map((t) => {
            const im = DATA.images.find((i) =>
              t.linked_image_files.includes(i.file),
            );
            return (
              '<button class="subcard" data-template="' +
              t.id +
              '">' +
              (im
                ? '<img loading="lazy" src="' +
                  im.preview +
                  '" alt="' +
                  esc(t.title) +
                  '">'
                : "") +
              "<span><b>" +
              esc(t.title) +
              "</b><small>" +
              t.linked_image_files.length +
              " method-linked images</small></span></button>"
            );
          })
          .join("") +
        "</div>"
      : "") +
    (other.length
      ? '<div class="section-title"><h2>Complete saved templates & adaptations</h2><small>' +
        other.length +
        ' complete records / image links unverified</small></div><p class="minor">These complete texts were saved or supplied by the gallery owner. Adaptations are not presented as verbatim originals from the supplied X posts.</p><div class="filter" style="margin-top:15px">' +
        other
          .map(
            (t) =>
              '<button class="back" data-template="' +
              t.id +
              '">' +
              esc(t.title) +
              " →</button>",
          )
          .join("") +
        "</div>"
      : "");
  $("source-templates").onclick = (e) => {
    const b = e.target.closest("[data-template]");
    if (b) {
      homeY = scrollY;
      location.hash = "template/" + b.dataset.template;
    }
  };
}
function showTemplate(t) {
  const method = t.source_kind === "current_canonical_template",
    conversation = t.source_kind === "conversation_original",
    linked = (t.linked_image_files || [])
      .map((f) => DATA.images.find((i) => i.file === f))
      .filter(Boolean),
    cit = t.public_source;
  const links = t.source?.resources || [];
  $("home").classList.add("hidden");
  $("detail").classList.remove("hidden");
  document.title = t.title + " · JML Source Templates";
  $("detail").innerHTML =
    '<div class="detail-header"><button class="back" id="back">← Back to gallery</button><div class="breadcrumb">' +
    (method
      ? "Recorded methods / Current source templates"
      : "Recovered source templates") +
    "</div><h1>" +
    esc(t.title) +
    '</h1><span class="badge">' +
    (method
      ? "Recorded method link · current template version"
      : conversation
        ? "Verbatim conversation template · image association unverified"
        : "Recovered saved input · submission and image association unverified") +
    '</span></div><div class="detail-layout"><section class="prompt-panel"><div class="panel-top"><h2>' +
    (method ? "Reusable source template" : "Recovered template") +
    '</h2><button class="solid" id="copy">Copy template</button></div><p class="source-kind">' +
    (method
      ? "This is the current canonical wrapper in Prompt Library. The job records its method ID, but the exact historical version and verbatim submission are not proven."
      : conversation
        ? "The original source message is verified. No association with a specific image in this archive is established."
        : "Readable text decodes editor formatting only. A surviving saved-input record does not establish that it was submitted.") +
    "</p>" +
    (t.public_source_match
      ? '<div class="notice" style="margin:0 0 18px"><strong>Public source text matched</strong><p>The source prompt matches this saved template after normalizing whitespace and bracket formatting and excluding the user’s short preface. Submission and archive-image associations remain unverified.</p></div>'
      : "") +
    '<pre class="prompt-text" tabindex="0">' +
    esc(t.readable_text || t.text || t.prompt) +
    "</pre>" +
    (method
      ? '<p class="minor">The wrapper is intended to produce a separate generator-ready prompt. The compiled build has seven methods and the current source registry has eight; version identity is not assumed. Original template wording, including brand settings, is preserved.</p>'
      : '<details><summary>Verbatim source record</summary><pre class="source-text">' +
        esc(t.text || t.prompt) +
        '</pre><button class="linkbtn" id="copy-raw">Copy verbatim record</button></details>') +
    '<details><summary>Source evidence</summary><div class="source-text">' +
    esc(json(t.source)) +
    "</div></details>" +
    (links.length
      ? "<details><summary>" +
        (conversation
          ? "Original conversation"
          : t.public_source_match
            ? "Matched public source"
            : "Referenced public inspiration") +
        "</summary>" +
        links
          .map(
            (r) =>
              '<p><a href="' +
              esc(r.url) +
              '" target="_blank" rel="noreferrer">' +
              esc(r.label || "Open cited source") +
              "</a></p>",
          )
          .join("") +
        '<p class="minor">' +
        (conversation
          ? "This link verifies the user-pasted template text. It does not establish a particular generated output."
          : t.public_source_match
            ? "The public source identifies this reusable template. The actual submitted image-specific prompt remains unverified."
            : "Public inspiration is not proof of the prompt submitted for these images.") +
        "</p>" +
        (cit
          ? '<p class="minor">Access check: ' +
            esc(cit.availability) +
            (cit.publication_date
              ? " · Published " + esc(cit.publication_date)
              : "") +
            (cit.credited_author ? " · " + esc(cit.credited_author) : "") +
            "</p>" +
            (cit.summary ? '<p class="minor">' + esc(cit.summary) + "</p>" : "")
          : "") +
        "</details>"
      : "") +
    "</section><section>" +
    (method
      ? '<div class="notice" style="margin-top:0"><strong>' +
        linked.length +
        ' images with recorded method links</strong><p>Each source job identifies this method and its archived output. These are not claimed to share an identical final prompt. Open an image to inspect its job evidence and surviving brief.</p></div><div class="sample-grid" style="margin-top:18px">' +
        linked
          .map(
            (im) =>
              '<article class="sample"><button data-linked="' +
              im.group_id +
              '" aria-label="Inspect method link for ' +
              esc(im.file) +
              '"><img loading="lazy" src="' +
              im.preview +
              '" alt="' +
              esc(im.file) +
              '"></button><div class="sample-info"><strong>' +
              esc(im.file) +
              "</strong><small>Recorded method → template · final prompt not recovered</small></div></article>",
          )
          .join("") +
        "</div>"
      : '<div class="notice" style="margin-top:0"><strong>No verified output association</strong><p>The surviving records do not prove which archive images were generated from this text. Similar-looking images are not treated as matches.</p></div>') +
    "</section></div>";
  $("copy").onclick = () => copy(t.readable_text || t.text || t.prompt);
  if ($("copy-raw")) $("copy-raw").onclick = () => copy(t.text || t.prompt);
  $("back").onclick = () => {
    location.hash = "archive-start";
  };
  $("detail").onclick = (e) => {
    const b = e.target.closest("[data-linked]");
    if (b) {
      currentTab = "template-" + t.id;
      location.hash = "prompt/" + b.dataset.linked;
    }
  };
  scrollTo(0, 0);
}
let sourceFamily = "all",
  sourceSubcategory = "all",
  sourceQuery = "";
function sourceTags(r) {
  return (
    Array.isArray(r.tags)
      ? r.tags
      : typeof r.tags === "string"
        ? r.tags.split(",")
        : []
  )
    .map((t) => String(t).trim())
    .filter(Boolean);
}
function sourceCredit(r) {
  const a = r.attribution;
  if (typeof a === "string") return a;
  if (a && typeof a === "object")
    return [a.author, a.community, a.name, a.note].filter(Boolean).join(" · ");
  return "";
}
function sourcePrompts(r) {
  const variants = r.prompts?.length
    ? r.prompts
    : r.prompt_variants?.length
      ? r.prompt_variants
      : [];
  if (variants.length)
    return variants
      .filter((p) => typeof p.text === "string" && p.text.trim())
      .map((p, i) => ({
        ...p,
        title:
          p.title ||
          "Source prompt" + (variants.length > 1 ? " " + (i + 1) : ""),
        source_url: p.source_url || r.prompt_url || r.url,
      }));
  return r.copy_text && String(r.copy_kind || "").includes("source_prompt")
    ? [
        {
          title: "Source prompt",
          text: r.copy_text,
          source_url: r.prompt_url || r.url,
        },
      ]
    : [];
}
function sourceSamples(r) {
  const all = [
      ...(r.sample_set_id
        ? DATA.source_sample_sets?.[r.sample_set_id] || []
        : []),
      ...(r.sample_images || []),
    ],
    seen = new Map();
  all.forEach((im, i) => {
    const key = im.preview || im.original || im.source_url || "missing-" + i;
    seen.set(key, { ...(seen.get(key) || {}), ...im });
  });
  return [...seen.values()];
}
function sourceImageUrl(im) {
  return sourceHref(im.preview || im.original);
}
function sourceHref(url) {
  return typeof url === "string" &&
    (/^(https?:\/\/)/i.test(url) || /^assets\/[a-z0-9_./%+@()-]+$/i.test(url))
    ? url
    : "";
}
function sourceLink(url, label, download = false) {
  const href = sourceHref(url);
  return href
    ? '<a href="' +
        esc(href) +
        '" target="_blank" rel="noreferrer noopener"' +
        (download && href.startsWith("assets/") ? " download" : "") +
        ">" +
        esc(label) +
        "</a>"
    : "";
}
function sourceDimensions(im) {
  const w = im.width || im.dimensions?.[0] || im.original_size?.[0],
    h = im.height || im.dimensions?.[1] || im.original_size?.[1];
  return w && h ? w + " × " + h + " px" : "";
}
function sourceArchiveImages(r) {
  const items = [
    ...(r.candidate_files || []).map((f) =>
      DATA.images.find((i) => i.file === f),
    ),
    ...(r.related_archive_images || []).map(
      (id) => IM.get(id) || IM.get(Number(id)),
    ),
  ].filter(Boolean);
  return [...new Map(items.map((im) => [im.id, im])).values()];
}
function sourceTextIndex(r) {
  return [
    r.title,
    r.source_family,
    r.subcategory,
    ...sourceTags(r),
    sourceCredit(r),
    r.summary,
    r.copy_text,
    ...sourcePrompts(r).map((p) => p.text),
    ...(r.adaptations || []).map((a) => a.text),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function renderSourceReviews() { window.JMLTaxonomy.render(); }
function renderSourceReviewResults() { window.JMLTaxonomy.render(); }
function sourceAdaptationPanel(a, i) {
  const image = sourceImageUrl(a),
    download = sourceHref(a.original),
    dimensions = sourceDimensions(a);
  return (
    '<article class="source-prompt-block"><div class="panel-top"><h3>' +
    esc(a.title || "Adaptation " + (i + 1)) +
    "</h3>" +
    (a.text
      ? '<button class="solid" data-copy-adaptation="' +
        i +
        '">Copy adaptation</button>'
      : "") +
    "</div>" +
    (a.note ? '<p class="minor">' + esc(a.note) + "</p>" : "") +
    (image
      ? '<div class="sample source-adaptation-image"><button data-adaptation-image="' +
        i +
        '" aria-label="Enlarge generated adaptation"><img loading="lazy" src="' +
        esc(image) +
        '" alt="' +
        esc(a.caption || a.title || "Generated adaptation") +
        '"></button><div class="sample-info"><strong>Generated adaptation</strong><small>' +
        esc(a.caption || "Demonstration, not an original source example.") +
        "</small><small>Any person depicted in this demonstration is fictional.</small>" +
        (dimensions
          ? "<small>" + esc(dimensions) + " · Available file dimensions</small>"
          : "") +
        (download
          ? '<div class="source-image-links">' +
            sourceLink(
              download,
              download.startsWith("assets/")
                ? "Download available image ↓"
                : "Open / save available image ↗",
              true,
            ) +
            "</div>"
          : "") +
        "</div></div>"
      : "") +
    (a.text
      ? '<pre class="prompt-text" tabindex="0">' + esc(a.text) + "</pre>"
      : "") +
    "</article>"
  );
}
function showSourceReview(r) {
  if (r.merged_into)
    r = DATA.source_reviews.items.find((x) => x.id === r.merged_into) || r;
  const candidates = sourceArchiveImages(r),
    samples = sourceSamples(r),
    prompts = sourcePrompts(r),
    adaptations = (r.adaptations || []).filter(
      (a) =>
        (typeof a.text === "string" && a.text.trim()) ||
        a.preview ||
        a.original,
    ),
    credit = sourceCredit(r),
    summaryText = !prompts.length ? r.copy_text : "",
    posts = [...new Set([r.url, ...(r.source_posts || [])].filter(Boolean))],
    tags = sourceTags(r);
  $("home").classList.add("hidden");
  $("source-reviews").classList.add("hidden");
  $("detail").classList.remove("hidden");
  document.title = r.title + " · JML Source Library";
  const promptPanels = prompts
    .map(
      (p, i) =>
        '<article class="source-prompt-block" id="source-prompt-' +
        i +
        '"><div class="panel-top"><h2>' +
        esc(p.title) +
        '</h2><button class="solid" data-copy-source="' +
        i +
        '" aria-label="Copy ' +
        esc(p.title) +
        '">Copy prompt' +
        (prompts.length > 1 ? " " + (i + 1) : "") +
        "</button></div>" +
        (p.role ? '<p class="source-kind">' + esc(p.role) + "</p>" : "") +
        '<pre class="prompt-text" tabindex="0">' +
        esc(p.text) +
        "</pre>" +
        (p.source_url
          ? '<p class="source-link-row">' +
            sourceLink(p.source_url, "Open this prompt’s source ↗") +
            "</p>"
          : "") +
        "</article>",
    )
    .join("");
  $("detail").innerHTML =
    '<div class="detail-header source-detail-header"><button class="back" id="back">← Back to source library</button><div class="breadcrumb">Source library / ' +
    esc(r.source_family || "Other") +
    (r.subcategory ? " / " + esc(r.subcategory) : "") +
    "</div><h1>" +
    esc(r.title) +
    "</h1>" +
    (r.summary
      ? '<p class="source-detail-summary">' + esc(r.summary) + "</p>"
      : "") +
    '<div class="detail-meta">' +
    (r.status ? '<span class="badge">' + esc(r.status) + "</span>" : "") +
    (credit
      ? "<span>" + esc(credit) + "</span>"
      : "<span>Author attribution not supplied</span>") +
    "</div>" +
    (tags.length
      ? '<div class="source-tags">' +
        tags.map((t) => "<span>" + esc(t) + "</span>").join("")
      : "") +
    '</div><div class="detail-layout source-detail-layout"><section class="prompt-panel source-prompt-panel"><p class="source-kind">' +
    esc(
      r.content_note ||
        "Source wording is preserved below. It is not a verified generation record for an archive image.",
    ) +
    "</p>" +
    (prompts.length > 1
      ? '<nav class="source-prompt-jumps" aria-label="Jump to source prompt">' +
        prompts
          .map(
            (p, i) =>
              '<button class="pill" data-source-jump="' +
              i +
              '">' +
              esc(p.title) +
              "</button>",
          )
          .join("") +
        "</nav>"
      : "") +
    (prompts.length
      ? promptPanels
      : summaryText
        ? '<article class="source-prompt-block"><div class="panel-top"><h2>Source summary</h2><button class="solid" data-copy-summary>' +
          esc(r.copy_label || "Copy summary") +
          '</button></div><pre class="prompt-text" tabindex="0">' +
          esc(summaryText) +
          "</pre></article>"
        : '<div class="missing">Source text is not available. The original link is retained; no replacement wording has been invented.</div>') +
    '<section class="source-reference-links"><h2>Source & attribution</h2><p class="minor">' +
    esc(credit || "Author attribution not supplied.") +
    "</p>" +
    posts
      .map(
        (u, i) =>
          "<p>" +
          sourceLink(
            u,
            "Open original source" +
              (posts.length > 1 ? " " + (i + 1) : "") +
              " ↗",
          ) +
          "</p>",
      )
      .join("") +
    (r.public_url
      ? "<p>" + sourceLink(r.public_url, "Read indexed source ↗") + "</p>"
      : "") +
    (r.prompt_url
      ? "<p>" +
        sourceLink(r.prompt_url, "Open original prompt reply ↗") +
        "</p>"
      : "") +
    (r.license_label
      ? '<p class="minor">' +
        (sourceLink(r.license_url, r.license_label) || esc(r.license_label)) +
        ". Attribution retained.</p>"
      : "") +
    "</section>" +
    (adaptations.length
      ? '<section class="source-adaptations"><h2>Optional adaptations</h2><p class="minor">Separate adapted wording, not the original source prompt or a verified historical generation input.</p>' +
        adaptations.map((a, i) => sourceAdaptationPanel(a, i)).join("") +
        "</section>"
      : "") +
    (r.saved_adaptation_ids?.length
      ? '<div class="notice"><strong>Complete saved adaptations</strong><p class="minor">Related saved templates, separate from the original source wording.</p>' +
        r.saved_adaptation_ids
          .map(
            (id) =>
              '<p><a href="#template/' +
              encodeURIComponent(id) +
              '">' +
              esc(TM.get(id)?.title || id) +
              " →</a></p>",
          )
          .join("") +
        "</div>"
      : "") +
    (r.evidence
      ? '<details><summary>Source and archive evidence</summary><p class="minor">' +
        esc(r.evidence) +
        "</p></details>"
      : "") +
    '</section><section class="source-image-panel"><h2>' +
    (r.sample_set_id ? "Shared family examples" : "Source examples") +
    '</h2><p class="minor">' +
    esc(
      r.sample_note ||
        (r.sample_set_id
          ? "User-supplied examples for this family. Exact example-to-post membership is not verified."
          : "Source examples are kept separate from the 247 original archive images. They do not establish an archive-generation association."),
    ) +
    "</p>" +
    (r.asset_note
      ? '<div class="notice source-asset-note">' + esc(r.asset_note) + "</div>"
      : "") +
    (samples.length
      ? '<div class="sample-grid source-sample-grid">' +
        samples
          .map((im, i) => {
            const preview = sourceImageUrl(im),
              original = sourceHref(im.original),
              dimensions = sourceDimensions(im);
            return (
              '<article class="sample">' +
              (preview
                ? '<button data-source-image="' +
                  i +
                  '" aria-label="Enlarge ' +
                  esc(im.caption || r.title + " source example " + (i + 1)) +
                  '"><img loading="lazy" src="' +
                  esc(preview) +
                  '" alt="' +
                  esc(im.caption || r.title + " source example " + (i + 1)) +
                  '"></button>'
                : '<div class="missing">Source image unavailable</div>') +
              '<div class="sample-info"><strong>' +
              esc(im.caption || "Source example " + (i + 1)) +
              "</strong>" +
              (im.role ? "<small>" + esc(im.role) + "</small>" : "") +
              (im.basis ? "<small>" + esc(im.basis) + "</small>" : "") +
              (im.notes || im.note || im.asset_note || im.resolution_note
                ? "<small>" +
                  esc(
                    im.notes || im.note || im.asset_note || im.resolution_note,
                  ) +
                  "</small>"
                : "") +
              (dimensions
                ? "<small>" +
                  esc(dimensions) +
                  (original ? " · Available file dimensions" : "") +
                  "</small>"
                : "") +
              '<div class="source-image-links">' +
              (original
                ? sourceLink(
                    original,
                    original.startsWith("assets/")
                      ? "Download available image ↓"
                      : "Open / save available image ↗",
                    true,
                  )
                : '<span class="minor">Image download not available</span>') +
              (im.source_url
                ? sourceLink(im.source_url, "Image source ↗")
                : "") +
              "</div></div></article>"
            );
          })
          .join("") +
        "</div>"
      : '<div class="notice source-asset-note"><strong>No source image available</strong><p>No image has been embedded for this series. The linked source may contain examples; any recovered prompt text remains available separately.</p></div>') +
    (candidates.length
      ? '<h2 class="source-related-heading">Archive comparisons</h2><p class="minor">Related archive images for comparison only. These links do not prove that a source template was the submitted generation prompt.</p><div class="sample-grid source-sample-grid">' +
        candidates
          .map(
            (im) =>
              '<article class="sample"><button data-candidate="' +
              esc(im.group_id) +
              '"><img loading="lazy" src="' +
              esc(im.preview) +
              '" alt="' +
              esc(im.file) +
              '"></button><div class="sample-info"><strong>' +
              esc(im.file) +
              "</strong><small>Archive comparison · adapted generation wording unverified</small></div></article>",
          )
          .join("") +
        "</div>"
      : "") +
    "</section></div>";
  $("back").onclick = () => {
    location.hash = "source-library";
  };
  $("detail").onclick = (e) => {
    const copyButton = e.target.closest("[data-copy-source]");
    if (copyButton) {
      copy(prompts[Number(copyButton.dataset.copySource)]?.text);
      return;
    }
    if (e.target.closest("[data-copy-summary]")) {
      copy(summaryText);
      return;
    }
    const adaptation = e.target.closest("[data-copy-adaptation]");
    if (adaptation) {
      copy(adaptations[Number(adaptation.dataset.copyAdaptation)]?.text);
      return;
    }
    const jump = e.target.closest("[data-source-jump]");
    if (jump) {
      $("source-prompt-" + jump.dataset.sourceJump)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    const candidate = e.target.closest("[data-candidate]");
    if (candidate) {
      openGroup(candidate.dataset.candidate);
      return;
    }
    const adaptedImage = e.target.closest("[data-adaptation-image]");
    if (adaptedImage) {
      const a = adaptations[Number(adaptedImage.dataset.adaptationImage)],
        caption = a.caption || a.title || "Generated adaptation";
      $("lightname").textContent = caption;
      $("lightimage").src = sourceHref(a.original) || sourceImageUrl(a);
      $("lightimage").alt = caption;
      document.querySelector(".lightfoot").innerHTML =
        "Generated adaptation · Any depicted person is fictional. " +
        (a.original
          ? sourceLink(
              a.original,
              a.original.startsWith("assets/")
                ? "Download available image ↓"
                : "Open / save available image ↗",
              true,
            )
          : "");
      $("lightbox").showModal();
      return;
    }
    const button = e.target.closest("[data-source-image]");
    if (button) {
      const im = samples[Number(button.dataset.sourceImage)],
        caption = im.caption || r.title + " · Source example";
      $("lightname").textContent = caption;
      $("lightimage").src = sourceHref(im.original) || sourceImageUrl(im);
      $("lightimage").alt = caption;
      document.querySelector(".lightfoot").innerHTML =
        "<span>" +
        esc(
          [im.role || "Source example", sourceDimensions(im), credit]
            .filter(Boolean)
            .join(" · "),
        ) +
        "</span>" +
        (im.original
          ? " " +
            sourceLink(
              im.original,
              im.original.startsWith("assets/")
                ? "Download available image ↓"
                : "Open / save available image ↗",
              true,
            )
          : " · Image download not available");
      $("lightbox").showModal();
    }
  };
  scrollTo(0, 0);
}
function historicalSourceCandidates(g) {
  const files = g.image_ids.map((id) => IM.get(id).file),
    rs = (DATA.source_reviews?.items || []).filter((r) =>
      (r.candidate_files || []).some((f) => files.includes(f)),
    );
  return rs.length
    ? '<details><summary>Unverified public-source comparisons</summary><p class="minor">Visual candidates only. These links do not establish the prompt used for this image.</p>' +
        rs
          .map(
            (r) =>
              '<p><a href="#source/' +
              r.id +
              '">' +
              esc(r.title) +
              " →</a></p>",
          )
          .join("") +
        "</details>"
    : "";
}
function sourceCandidates(g) {
  const old = historicalSourceCandidates(g),
    cs = g.image_ids.flatMap((id) => PC.get(id)?.source_candidates || []);
  return (
    old +
    (cs.length
      ? "<details><summary>Suggested source matches · " +
        cs.length +
        '</summary><p class="minor">Visually supported template comparisons, not proof of the original submitted prompt.</p>' +
        cs
          .map(
            (c) =>
              '<p><a href="' +
              esc(c.source_url) +
              '" target="_blank" rel="noreferrer">Open source comparison ↗</a><br>' +
              esc(c.observed_matching_basis || c.basis || "") +
              "</p>",
          )
          .join("") +
        "</details>"
      : "")
  );
}
function setFamily(id) {
  family = id;
  sub = "all";
  renderFamilies();
  renderSubtypes();
  renderGrid();
}
function renderFamilies() {
  $("styles").innerHTML = DATA.families
    .map(
      (f) =>
        '<button class="style" data-family="' +
        f.id +
        '" aria-pressed="' +
        (family === f.id) +
        '"><img loading="lazy" src="' +
        IM.get(f.cover).preview +
        '" alt="' +
        esc(f.title) +
        '"><span><b>' +
        esc(f.title) +
        "</b><small>" +
        num(DATA.images.filter((i) => i.family === f.id).length) +
        " images · " +
        f.subcategories.length +
        (f.subcategories.length === 1 ? " style" : " styles") +
        "</small></span></button>",
    )
    .join("");
  $("filters").innerHTML = [
    { id: "all", title: "All families" },
    ...DATA.families,
  ]
    .map(
      (f) =>
        '<button class="pill" data-family="' +
        f.id +
        '" aria-pressed="' +
        (family === f.id) +
        '">' +
        esc(f.title) +
        "</button>",
    )
    .join("");
}
function renderSubtypes() {
  const f = FA.get(family);
  $("subtypes").classList.toggle("hidden", !f);
  if (!f) return;
  $("subtypes").innerHTML =
    '<div class="subheading"><h3>' +
    esc(f.title) +
    '</h3><button class="back" data-sub="all">All ' +
    esc(f.title.toLowerCase()) +
    '</button></div><p class="description">' +
    esc(
      f.description ||
        "Subcategories reflect visual evidence and recovered prompts where available.",
    ) +
    '</p><div class="subgrid">' +
    f.subcategories
      .map(
        (c) =>
          '<button class="subcard" data-sub="' +
          c.id +
          '" aria-pressed="' +
          (sub === c.id) +
          '"><img loading="lazy" src="' +
          IM.get(c.cover).preview +
          '" alt="' +
          esc(c.title) +
          '"><span><b>' +
          esc(c.title) +
          "</b><small>" +
          num(DATA.images.filter((i) => i.category === c.id).length) +
          " images</small></span></button>",
      )
      .join("") +
    "</div>";
}
function renderGrid() {
  const needle = q.toLowerCase().trim(),
    groups = DATA.groups.filter(
      (g) =>
        (family === "all" ||
          g.image_ids.some((id) => IM.get(id).family === family)) &&
        (sub === "all" ||
          g.image_ids.some((id) => IM.get(id).category === sub)) &&
        (source === "all" ||
          (source === "user_original"
            ? Boolean(original(g))
            : kind(g) === source)) &&
        (!needle ||
          [
            g.title,
            g.prompt,
            g.user_original_prompt,
            g.recorded_revised_prompt,
            ...g.image_ids.map(
              (id) => PC.get(id)?.reconstruction?.prompt || "",
            ),
            g.notes,
            CA.get(g.category)?.title,
            FA.get(g.family)?.title,
            ...g.image_ids.flatMap((id) => [
              IM.get(id).file,
              ...(IM.get(id).tags || []),
            ]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  $("count").textContent =
    num(groups.length) +
    " entries · " +
    num(groups.reduce((n, g) => n + g.image_ids.length, 0)) +
    " images";
  $("grid").innerHTML = groups.length
    ? groups
        .map((g) => {
          const im = IM.get(g.image_ids.includes(151) ? 151 : g.image_ids[0]);
          return (
            '<button class="card" data-group="' +
            g.id +
            '" aria-label="View source for ' +
            esc(g.title) +
            '"><div class="preview"><img loading="lazy" src="' +
            im.preview +
            '" alt="' +
            esc(g.title) +
            '"><span class="image-count">' +
            num(g.image_ids.length) +
            " " +
            (g.image_ids.length === 1 ? "output" : "outputs") +
            '</span></div><div class="card-body"><span class="type-label">' +
            esc(CA.get(g.category)?.title || g.category) +
            '</span><div class="card-title">' +
            esc(g.title) +
            '</div><div class="card-meta">' +
            badge(g) +
            (original(g)
              ? '<span class="badge">User instructions linked</span>'
              : "") +
            "</div></div></button>"
          );
        })
        .join("")
    : '<p class="empty">No matches. Try another style, source status or search.</p>';
}
function openGroup(id) {
  homeY = scrollY;
  currentTab = "";
  location.hash = "prompt/" + id;
}
function historicalPromptOptions(g) {
  const opts = [];
  for (const link of g.method_template_links || []) {
    const t = TM.get(link.source_template_id);
    if (t)
      opts.push({
        id: "template-" + t.id,
        label: "Source template",
        heading: "Method-linked source template",
        text: t.text,
        source: { template: t.source, association: link },
        caption:
          "The generation job records this method. The text below is the current reusable wrapper, not a verified historical version or the final image-specific generation prompt.",
        template_id: t.id,
      });
  }
  if (revised(g))
    opts.push({
      id: "revised",
      label: "Recorded revised",
      heading: "Recorded generation prompt",
      text: revised(g),
      source: g.revised_prompt_source || g.prompt_source,
      caption:
        "Verbatim revisedPrompt from the generation record. This is not automatically the user’s original wording.",
    });
  if (original(g))
    opts.push({
      id: "original",
      label: "User original",
      heading:
        g.user_original_scope === "batch request"
          ? "Original batch request"
          : "Original user instructions",
      text: original(g),
      source: g.user_original_source,
      caption:
        g.user_original_scope === "batch request"
          ? "The user’s verbatim batch request, linked to this output. It is not an independent per-image generation prompt."
          : "Verbatim user-authored instructions linked to this output. Reference attachments, follow-ups and model revisions may also have affected the generation.",
    });
  if (g.prompt_status === "source_brief" && g.prompt)
    opts.push({
      id: "brief",
      label: "Source brief",
      heading:
        g.source_text_kind === "metadata"
          ? "Source metadata"
          : "Surviving source brief",
      text: g.prompt,
      source: g.prompt_source,
      caption:
        g.source_text_kind === "metadata"
          ? "Palette and job metadata only. This is not an original prompt or a generation call."
          : "Related source text survives, but its match to the final generation call is not verified.",
    });
  return opts;
}
function promptOptions(g) {
  const historic = historicalPromptOptions(g),
    newopts = [];
  for (const iid of g.image_ids) {
    const p = PC.get(iid);
    if (!p) continue;
    for (const t of p.source_options || [])
      newopts.push({
        id: t.id,
        label: "Suggested source template",
        heading: t.title,
        text: t.text,
        source: t.basis,
        caption:
          "Recovered reusable source wording with a visually supported style match. This is not proof of the exact prompt originally submitted for this image." +
          (t.attribution
            ? " Source: " + t.attribution + ". " + t.license_label + "."
            : ""),
        template_id: t.template_id,
        source_id: t.source_id,
      });
    if (p.reconstruction) {
      const r = p.reconstruction,
        recipe = r.kind === "reconstructed_compositing_recipe";
      newopts.push({
        id: "reconstructed-" + iid,
        label: recipe ? "New compositing recipe" : "New reconstructed prompt",
        heading: recipe
          ? "New compositing recipe"
          : "New image-based reconstruction",
        text: r.prompt,
        source: {
          kind: r.kind,
          visual_basis: r.visual_basis,
          confidence: r.confidence,
          source_refs: r.source_refs || [],
        },
        caption:
          "Newly written from the visible image" +
          (r.source_refs?.length ? " and available source context" : "") +
          ". This is a usable reconstruction, not a recovered original. It may produce similar results, not an identical image.",
      });
    }
  }
  return [
    ...historic.filter((o) => o.id === "revised"),
    ...historic.filter((o) => o.template_id),
    ...newopts,
    ...historic.filter((o) => o.id !== "revised" && !o.template_id),
  ];
}
function exportPromptLedger() {
  const rows = DATA.prompt_coverage.items.map((p) => {
      const im = IM.get(p.image_id);
      return { ...p, file: im.file, recorded_prompt: revised(im) || null };
    }),
    blob = new Blob(
      [
        JSON.stringify(
          { description: DATA.prompt_coverage.description, images: rows },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = "JML-image-by-image-prompt-ledger.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
function renderPrompt(g) {
  const opts = promptOptions(g),
    o = opts.find((o) => o.id === currentTab) || opts[0];
  currentTab = o?.id || "";
  $("prompt-content").innerHTML =
    (opts.length > 1
      ? '<div class="prompt-tabbar" role="tablist">' +
        opts
          .map(
            (t) =>
              '<button role="tab" data-tab="' +
              t.id +
              '" aria-selected="' +
              (t.id === currentTab) +
              '">' +
              t.label +
              "</button>",
          )
          .join("") +
        "</div>"
      : "") +
    '<div class="panel-top"><h2>' +
    (o ? o.heading : "Original prompt not recovered") +
    '</h2><button class="solid" id="copy" ' +
    (o ? "" : "disabled") +
    ">" +
    (o ? "Copy prompt" : "Unavailable") +
    "</button></div>" +
    (o
      ? '<p class="source-kind">' +
        esc(o.caption) +
        '</p><pre id="prompt" class="prompt-text" tabindex="0">' +
        esc(o.text) +
        "</pre>"
      : '<div class="missing">The exact generation call for this image has not been found in the checked sources. A usable reconstruction will appear separately when available.</div>') +
    (o?.source_id
      ? '<p><a href="#source/' +
        o.source_id +
        '">Open source prompt and examples →</a></p>'
      : "") +
    (o?.template_id
      ? '<p class="minor"><button class="linkbtn" data-template-view="' +
        o.template_id +
        '">View this template with all method-linked images →</button></p>'
      : "") +
    '<p class="minor">' +
    esc(
      g.notes ||
        "Different prompt wording stays separate. Visual similarity is not treated as evidence of a shared generation prompt.",
    ) +
    '</p><details><summary>Prompt source and association evidence</summary><div class="source-text">' +
    esc(json(o?.source || g.prompt_source)) +
    (g.generation_id ? "\nGeneration: " + esc(g.generation_id) : "") +
    "</div>" +
    (g.association_evidence
      ? '<div class="source-text">' +
        esc(json(g.association_evidence)) +
        "</div>"
      : "") +
    (g.references
      ? '<div class="source-text">' + esc(json(g.references)) + "</div>"
      : "") +
    "</details>" +
    sourceCandidates(g);
  $("copy").onclick = () => copy(o?.text);
  $("prompt-content").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) {
      currentTab = b.dataset.tab;
      renderPrompt(g);
    }
    const t = e.target.closest("[data-template-view]");
    if (t) location.hash = "template/" + t.dataset.templateView;
  };
}
function renderGeneratedExamples() {
  const items = DATA.generated_examples?.items || [],
    section = $("generated-examples");
  if (!items.length) return;
  const families = [...new Set(items.map((x) => x.family))];
  section.classList.remove("hidden");
  section.innerHTML =
    '<div class="section-title"><h2>Generated JML examples</h2><small>' +
    items.length +
    " new examples · " +
    items.filter((x) => x.format === "portrait").length +
    " portrait concepts · " +
    items.filter((x) => x.format === "wide").length +
    ' wide blog covers</small></div><p class="minor">New campaign concepts created from the supplied references. These are separate from the 247 selected archive images. Charts and campaign scenes are illustrative, not measured client results.</p>' +
    families
      .map(
        (f) =>
          '<h3 style="font-family:var(--display);margin-top:30px">' +
          esc(f) +
          '</h3><div class="grid">' +
          items
            .filter((x) => x.family === f)
            .map(
              (x) =>
                '<button class="card ' +
                (x.format === "wide" ? "generated-wide" : "") +
                '" data-generated="' +
                x.id +
                '"><div class="preview"><img loading="lazy" src="' +
                x.preview +
                '" alt="' +
                esc(x.title) +
                '"><span class="image-count">New JML example</span></div><div class="card-body"><span class="type-label">' +
                esc(x.family) +
                '</span><div class="card-title">' +
                esc(x.title) +
                '</div><div class="card-meta"><span class="badge verified">' +
                (x.prompt_kind === "exact_submitted"
                  ? "Recorded submitted prompt"
                  : "Reproducible brief") +
                "</span></div></div></button>",
            )
            .join("") +
          "</div>",
      )
      .join("");
  section.onclick = (e) => {
    const b = e.target.closest("[data-generated]");
    if (b) location.hash = "generated/" + b.dataset.generated;
  };
}
function showGeneratedExample(x) {
  $("home").classList.add("hidden");
  $("detail").classList.remove("hidden");
  document.title = x.title + " · JML Examples";
  const refs = (x.references || []).map((r) => ({
    ...r,
    preview:
      r.archive_image_id != null
        ? IM.get(r.archive_image_id).preview
        : r.preview,
  }));
  $("detail").innerHTML =
    '<div class="detail-header"><button class="back" id="back">' +
    (x.article_id ? "← Back to article styles" : "← Back to JML examples") +
    '</button><div class="breadcrumb">Generated JML examples / ' +
    esc(x.family) +
    "</div><h1>" +
    esc(x.title) +
    '</h1><span class="badge verified">New AI-generated example · November 6, 2026</span></div><div class="detail-layout"><aside class="prompt-panel"><div class="panel-top"><h2>' +
    (x.prompt_kind === "exact_submitted"
      ? "Submitted generation prompt"
      : "Reproducible generation brief") +
    '</h2><button class="solid" id="copy-generated">Copy prompt</button></div><p class="source-kind">' +
    (x.prompt_kind === "exact_submitted"
      ? "Recorded text used to create this new example. Revision instructions are included when applicable. This is not a recovered historical X prompt."
      : "A normalized brief for reproducing this new example. It is not claimed to be the exact submitted generation text or the historical source prompt.") +
    '</p><pre class="prompt-text" tabindex="0">' +
    esc(x.prompt) +
    "</pre>" +
    (x.article_url
      ? '<p><a href="' +
        esc(x.article_url) +
        '" target="_blank" rel="noreferrer">Open existing article ↗</a></p><p class="minor">' +
        esc(x.provenance) +
        "</p>"
      : "") +
    (x.source_id
      ? '<p><a href="#source/' +
        x.source_id +
        '">Browse the related source family →</a></p>'
      : "") +
    '<details><summary>Generation and file evidence</summary><div class="source-text">' +
    esc(
      "Created: " +
        x.created_at +
        "\nFile: " +
        x.file +
        "\nSHA-256: " +
        x.sha256 +
        "\nPrompt evidence: " +
        x.prompt_evidence +
        "\n" +
        (x.provenance || ""),
    ) +
    '</div></details></aside><section><h2 style="font-family:var(--display)">Generated example</h2><div class="sample-grid single"><article class="sample"><button data-generated-image="output" aria-label="Enlarge generated example"><img src="' +
    x.preview +
    '" alt="' +
    esc(x.title) +
    '"></button><div class="sample-info"><strong>' +
    esc(x.file) +
    "</strong><small>" +
    (x.format === "wide"
      ? "New JML wide image"
      : x.format === "square"
        ? "New JML square image"
        : "New JML portrait concept") +
    " · " +
    x.dimensions.join(" × ") +
    " pixels</small></div></article></div>" +
    (refs.length
      ? '<h2 style="font-family:var(--display);margin-top:30px">Supplied style reference</h2><p class="minor">Reference artwork remains separate from the new generated example.</p><div class="sample-grid">' +
        refs
          .map(
            (r, i) =>
              '<article class="sample"><button data-generated-image="ref-' +
              i +
              '" aria-label="Enlarge supplied reference ' +
              (i + 1) +
              '"><img src="' +
              r.preview +
              '" alt="' +
              esc(r.title) +
              '"></button><div class="sample-info"><strong>' +
              esc(r.title) +
              "</strong><small>User-supplied reference" +
              (r.reused_existing_preview ? " · Existing preview reused" : "") +
              "</small></div></article>",
          )
          .join("") +
        "</div>"
      : "") +
    "</section></div>";
  $("copy-generated").onclick = () => copy(x.prompt);
  $("back").onclick = () => {
    location.hash = x.article_id
      ? "article/" + x.article_id + "/" + styleKey(x.family)
      : "generated-examples";
  };
  $("detail").onclick = (e) => {
    const b = e.target.closest("[data-generated-image]");
    if (!b) return;
    const im =
      b.dataset.generatedImage === "output"
        ? { preview: x.preview, title: x.title }
        : refs[Number(b.dataset.generatedImage.slice(4))];
    $("lightname").textContent = im.title;
    $("lightimage").src = im.preview;
    $("lightimage").alt = im.title;
    document.querySelector(".lightfoot").textContent =
      b.dataset.generatedImage === "output"
        ? "New generated example. Original full-size file retained."
        : "User-supplied style reference, separate from the new example.";
    $("lightbox").showModal();
  };
  scrollTo(0, 0);
}

const ARTICLE_STYLES = [
  ...new Set((DATA.article_examples || []).map((x) => x.family)),
];
const styleKey = (f) =>
  ({
    "People + line art": "line-art",
    "Surreal human & object collage": "surreal",
    "Illustrated animals": "animals",
    "Documentary style (AI-generated)": "documentary",
    "Paper-cut landscapes": "paper-cut",
    "Floating editorial paper": "floating-paper",
    "Translucent acrylic panels": "acrylic",
    "Photographic ribbon": "ribbon",
  })[f] || encodeURIComponent(f);
let articleStyleSelection = {},
  blogFilter = "all",
  squarePreviews = true;
function setWorkspace(hash) {
  const generated = hash.startsWith("#generated/")
    ? [
        ...(DATA.generated_examples?.items || []),
        ...(DATA.article_examples || []),
      ].find((x) => x.id === decodeURIComponent(hash.slice(11)))
    : null;
  const section =
    hash.startsWith("#article/") ||
    hash === "#blog-samples" ||
    hash === "#article-projects" ||
    generated?.article_id
      ? "blog"
      : hash === "#generated-examples" || generated
        ? "examples"
        : hash === "#source-library" || hash.startsWith("#source/") || hash.startsWith("#prompt/") || hash.startsWith("#template/")
          ? "sources"
          : "archive";
  [
    "home",
    "source-reviews",
    "blog-samples",
    "generated-examples",
    "detail",
  ].forEach((id) => $(id).classList.add("hidden"));
  ["archive", "sources", "blog", "examples"].forEach((id) =>
    $("nav-" + id).removeAttribute("aria-current"),
  );
  $("nav-" + section).setAttribute("aria-current", "page");
  if (section === "archive") $("home").classList.remove("hidden");
  else if (section === "sources" && hash === "#source-library")
    $("source-reviews").classList.remove("hidden");
  else if (section === "blog" && !hash.startsWith("#article/") && !generated)
    $("blog-samples").classList.remove("hidden");
  else if (section === "examples" && !generated)
    $("generated-examples").classList.remove("hidden");
}
function renderArticleProjects() {
  const projects = DATA.article_projects || [],
    section = $("article-projects");
  if (!projects.length) return;
  section.innerHTML =
    '<header class="sample-hero"><p class="eyebrow">Blog samples / Pick a cover</p><h1>One article.<br>Eight visual directions.</h1><p>Choose a cover to open its complete set: one cover and three supporting images from the same theme. Every set includes the original article link and copyable prompts.</p><div class="set-summary"><span class="badge verified">4 articles</span><span class="badge">32 themed sets</span><span class="badge">128 generated images</span></div></header><div class="style-filter" aria-label="Filter blog samples by style">' +
    ["all", ...ARTICLE_STYLES]
      .map(
        (f) =>
          '<button data-blog-filter="' +
          esc(f) +
          '" aria-pressed="' +
          (f === blogFilter) +
          '">' +
          esc(f === "all" ? "All eight styles" : f) +
          "</button>",
      )
      .join("") +
    "</div>" +
    projects
      .map((a) => {
        const items = (DATA.article_examples || []).filter(
          (x) => x.article_id === a.id,
        );
        return (
          '<section class="blog-section"><div class="blog-section-header"><h2>' +
          esc(a.title) +
          '</h2><a href="' +
          esc(a.url) +
          '" target="_blank" rel="noreferrer">Read original article ↗</a></div><div class="grid">' +
          ARTICLE_STYLES.filter((f) => blogFilter === "all" || f === blogFilter)
            .map((f) => {
              const set = items.filter((x) => x.family === f),
                cover = set.find((x) => x.role === "cover");
              return (
                '<button class="card generated-wide set-card" data-article="' +
                a.id +
                '" data-set-style="' +
                styleKey(f) +
                '" aria-label="Open ' +
                esc(f) +
                " set for " +
                esc(a.title) +
                '"><div class="preview"><img loading="lazy" src="' +
                cover.preview +
                '" alt="' +
                esc(cover.title) +
                '"><span class="image-count">' +
                (set
                  .filter((x) => x.role !== "cover")
                  .every((x) => x.format === "square")
                  ? "Cover + 3 square images"
                  : "Cover + 3 images") +
                '</span></div><div class="card-body"><span class="type-label">AI-generated article set</span><div class="card-title">' +
                esc(f) +
                '</div><div class="card-meta">View this themed set →</div></div></button>'
              );
            })
            .join("") +
          "</div></section>"
        );
      })
      .join("");
  section.onclick = (e) => {
    const f = e.target.closest("[data-blog-filter]");
    if (f) {
      blogFilter = f.dataset.blogFilter;
      renderArticleProjects();
      return;
    }
    const b = e.target.closest("[data-article]");
    if (b)
      location.hash = "article/" + b.dataset.article + "/" + b.dataset.setStyle;
  };
}
function articleImageCard(x, isCover) {
  return (
    '<button class="card" data-article-image="' +
    x.id +
    '" aria-label="Open image and prompt: ' +
    esc(x.title) +
    '"><div class="preview"><img loading="lazy" src="' +
    x.preview +
    '" alt="' +
    esc(x.title) +
    '"><span class="image-count">' +
    (isCover ? "Cover" : esc(x.role_label || "Supporting image")) +
    '</span></div><div class="card-body"><div class="card-title">' +
    esc(x.title) +
    '</div><div class="card-meta"><span class="badge verified">Open image & prompt</span><span>' +
    x.dimensions.join(" × ") +
    " px original</span></div></div></button>"
  );
}
function showArticleProject(a) {
  const items = (DATA.article_examples || []).filter(
      (x) => x.article_id === a.id,
    ),
    styles = [...new Set(items.map((x) => x.family))],
    selected = styles.includes(articleStyleSelection[a.id])
      ? articleStyleSelection[a.id]
      : styles[0],
    set = items.filter((x) => x.family === selected),
    cover = set.find((x) => x.role === "cover"),
    support = set.filter((x) => x.role !== "cover"),
    nativeSquare = support.every((x) => x.dimensions[0] === x.dimensions[1]);
  $("home").classList.add("hidden");
  $("detail").classList.remove("hidden");
  document.title = a.title + " · JML Blog Samples";
  $("detail").innerHTML =
    '<div class="detail-header"><button class="back" id="back">← All blog samples</button><div class="breadcrumb">Blog samples / ' +
    esc(selected) +
    "</div><h1>" +
    esc(a.title) +
    '</h1><p><a class="solid" style="display:inline-block;text-decoration:none" href="' +
    esc(a.url) +
    '" target="_blank" rel="noreferrer">Read original article ↗</a></p><p class="minor">One cover + three supporting images in a consistent theme. These generated concepts are separate from your archive and are not automatically published to the article.</p></div><div class="prompt-tabbar article-tabs" role="tablist" aria-label="Article image styles">' +
    styles
      .map(
        (f) =>
          '<button role="tab" data-article-style="' +
          esc(f) +
          '" aria-selected="' +
          (f === selected) +
          '">' +
          esc(f) +
          "</button>",
      )
      .join("") +
    "</div>" +
    (selected === "Documentary style (AI-generated)"
      ? '<p class="notice"><strong>AI-generated documentary-style concepts.</strong> These are not real photographs of firms, staff, clients, offices or events.</p>'
      : "") +
    '<section class="cover-stage"><p class="article-cover-label">01 / COVER</p>' +
    articleImageCard(cover, true) +
    '</section><div class="support-heading"><h2>Three supporting images</h2>' +
    (nativeSquare
      ? ""
      : '<button class="back" id="toggle-square" aria-pressed="' +
        squarePreviews +
        '">' +
        (squarePreviews ? "Show full images" : "Show square previews") +
        "</button>") +
    '</div><p class="preview-note">' +
    (nativeSquare
      ? "Three native square originals, individually generated in the same style as the cover. Click any image for its full view and exact prompt."
      : squarePreviews
        ? "Square display crops only. The original files are wide and remain unchanged. Click any image to see the full composition and prompt."
        : "Full compositions displayed inside square frames. The original files and their proportions remain unchanged.") +
    '</p><div class="support-grid ' +
    (squarePreviews ? "" : "uncropped") +
    '">' +
    support.map((x) => articleImageCard(x, false)).join("") +
    "</div>";
  $("back").onclick = () => (location.hash = "blog-samples");
  $("detail").onclick = (e) => {
    const f = e.target.closest("[data-article-style]");
    if (f) {
      articleStyleSelection[a.id] = f.dataset.articleStyle;
      location.hash =
        "article/" + a.id + "/" + styleKey(f.dataset.articleStyle);
      return;
    }
    if (e.target.closest("#toggle-square")) {
      squarePreviews = !squarePreviews;
      const y = scrollY;
      showArticleProject(a);
      scrollTo(0, y);
      return;
    }
    const b = e.target.closest("[data-article-image]");
    if (b) location.hash = "generated/" + b.dataset.articleImage;
  };
  scrollTo(0, 0);
}

function route() {
  if (location.hash === "#archive-start") location.hash = "source-library";
  if (!location.hash) location.hash = "source-library";
  setWorkspace(location.hash);
  if ($("lightbox").open) $("lightbox").close();
  if (location.hash.startsWith("#article/")) {
    const parts = location.hash.slice(9).split("/"),
      a = (DATA.article_projects || []).find(
        (a) => a.id === decodeURIComponent(parts[0]),
      );
    if (a) {
      const chosen = ARTICLE_STYLES.find((f) => styleKey(f) === parts[1]);
      if (chosen) articleStyleSelection[a.id] = chosen;
      showArticleProject(a);
      return;
    }
  }
  if (location.hash.startsWith("#generated/")) {
    const x = [
      ...(DATA.generated_examples?.items || []),
      ...(DATA.article_examples || []),
    ].find((x) => x.id === decodeURIComponent(location.hash.slice(11)));
    if (x) {
      showGeneratedExample(x);
      return;
    }
  }
  if (location.hash.startsWith("#source/")) {
    const r = (DATA.source_reviews?.items || []).find(
      (r) =>
        r.id === decodeURIComponent(location.hash.slice(8)) ||
        (r.aliases || []).includes(decodeURIComponent(location.hash.slice(8))),
    );
    if (r) {
      showSourceReview(r);
      return;
    }
  }
  if (location.hash.startsWith("#template/")) {
    const t = TM.get(decodeURIComponent(location.hash.slice(10)));
    if (t) {
      showTemplate(t);
      return;
    }
  }
  if (location.hash === "#source-library") {
    document.title = "Source Prompt Library · JML";
    scrollTo(0, 0);
    return;
  }
  if (
    ["#blog-samples", "#article-projects", "#generated-examples"].includes(
      location.hash,
    )
  ) {
    document.title =
      location.hash === "#generated-examples"
        ? "Generated Examples · JML"
        : "Blog Samples · JML";
    scrollTo(0, 0);
    return;
  }
  const id = decodeURIComponent(location.hash.replace(/^#prompt\//, ""));
  if (!id || !GR.has(id)) {
    $("home").classList.remove("hidden");
    $("detail").classList.add("hidden");
    document.title = "Image & Prompt Archive · JML";
    requestAnimationFrame(() => {
      const a =
        location.hash === "#archive-start"
          ? "archive-start"
          : location.hash === "#source-library"
            ? "source-library"
            : location.hash === "#generated-examples"
              ? "generated-examples"
              : location.hash === "#article-projects"
                ? "article-projects"
                : null;
      if (a) $(a)?.scrollIntoView();
      else scrollTo(0, homeY);
    });
    return;
  }
  const g = GR.get(id);
  $("home").classList.add("hidden");
  $("detail").classList.remove("hidden");
  document.title = g.title + " · JML Archive";
  $("detail").innerHTML =
    '<div class="detail-header"><button class="back" id="back">← Back to gallery</button><div class="breadcrumb">' +
    esc(FA.get(g.family)?.title || "") +
    " / " +
    esc(CA.get(g.category)?.title || "") +
    "</div><h1>" +
    esc(g.title) +
    '</h1><div class="detail-meta">' +
    badge(g) +
    "<span>" +
    num(g.image_ids.length) +
    ' related archive files</span></div></div><div class="detail-layout"><aside class="prompt-panel"><div id="prompt-content"></div></aside><section><div class="sample-grid ' +
    (g.image_ids.length === 1 ? "single" : "") +
    '">' +
    g.image_ids
      .map((id) => {
        const im = IM.get(id);
        return (
          '<article class="sample"><button data-image="' +
          id +
          '" aria-label="Enlarge ' +
          esc(im.file) +
          '"><img src="' +
          im.preview +
          '" alt="' +
          esc(im.file) +
          '"></button><div class="sample-info"><strong>' +
          esc(im.file) +
          "</strong><small>" +
          im.original_size.join(" × ") +
          " px · " +
          esc(im.relationship || "relationship unknown") +
          '</small><details><summary>Original file & style evidence</summary><div class="source-text">Archive file: ' +
          esc(im.source) +
          "\nOriginal source: " +
          esc(im.original_source) +
          "\nSHA-256: " +
          esc(im.sha256) +
          "\nCollection: " +
          esc(im.collection) +
          "\nBrand (metadata only): " +
          esc(im.brand) +
          "\nRelationship: " +
          esc(im.relationship || "unknown") +
          "\nStyle evidence: " +
          esc(json(im.classification_basis)) +
          "\nStyle notes: " +
          esc(im.classification_notes || "") +
          "\nTags: " +
          esc((im.tags || []).join(", ")) +
          '</div><button class="linkbtn" data-path="' +
          id +
          '">Copy original file path</button></details></div></article>'
        );
      })
      .join("") +
    '</div><p class="minor">' +
    (revised(g)
      ? "Only outputs with identical verified generation text are grouped here."
      : "This entry remains separate to avoid claiming an unverified shared prompt.") +
    " Click an image to enlarge.</p></section></div>";
  renderPrompt(g);
  const related = [
    ...new Set(g.image_ids.flatMap((id) => IM.get(id).related_outputs || [])),
  ]
    .map((f) => DATA.images.find((i) => i.file === f))
    .filter(Boolean);
  if (related.length) {
    const section = document.createElement("section");
    section.className = "notice";
    section.innerHTML =
      "<strong>Verified derived output</strong><p>This source image was reused in the layout below. This is not an independent generation with the same prompt.</p>" +
      related
        .map(
          (im) =>
            '<button class="back" data-related="' +
            im.group_id +
            '"><img src="' +
            im.preview +
            '" style="height:85px;width:65px;object-fit:contain" alt="' +
            esc(im.file) +
            '"><span>' +
            esc(im.file) +
            "</span></button>",
        )
        .join("");
    $("detail").append(section);
    section.onclick = (e) => {
      const b = e.target.closest("[data-related]");
      if (b) {
        currentTab = "";
        location.hash = "prompt/" + b.dataset.related;
      }
    };
  }
  $("back").onclick = () => {
    location.hash = "";
  };
  $("detail").onclick = (e) => {
    const a = e.target.closest("[data-image]");
    if (a) showImage(Number(a.dataset.image));
    const b = e.target.closest("[data-path]");
    if (b) copy(IM.get(Number(b.dataset.path)).source);
  };
  scrollTo(0, 0);
}
function showImage(id) {
  const im = IM.get(id);
  $("lightname").textContent = im.file;
  $("lightimage").src = im.preview;
  $("lightimage").alt = im.file;
  document.querySelector(".lightfoot").textContent =
    "Compressed preview. Original filenames and dimensions remain in the file details. Private source locations are omitted.";
  $("lightbox").showModal();
}
function exportManifest() {
  const data = { ...DATA, images: DATA.images.map(({ preview, ...x }) => x) },
    blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = "image-prompt-provenance.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
addEventListener("hashchange", route);
init();

