/* Non-destructive gallery display policy. Canonical records/assets remain intact. */
window.JMLVisibility = {
  apply(raw) {
    const policy = raw.display_policy || {};
    const excluded = new Set(policy.excluded_asset_paths || []);
    const hiddenIds = new Set(policy.excluded_archive_image_ids || []);
    const clone = (value) => {
      if (Array.isArray(value))
        return value.map(clone).filter((x) => x !== undefined);
      if (typeof value === "string")
        return (policy.canonical_asset_paths || {})[value] || value;
      if (!value || typeof value !== "object") return value;
      if (
        ["preview", "original", "asset_path"].some((key) =>
          excluded.has(value[key]),
        )
      )
        return undefined;
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, clone(v)]),
      );
    };
    const data = clone(raw);
    data.images = data.images.filter((im) => !hiddenIds.has(im.id));
    const ids = new Set(data.images.map((im) => im.id));
    data.groups = data.groups
      .map((g) => ({
        ...g,
        image_ids: g.image_ids.filter((id) => ids.has(id)),
      }))
      .filter((g) => g.image_ids.length);
    data.categories = data.categories.map((c) => ({
      ...c,
      count: data.images.filter((im) => im.category === c.id).length,
      cover: ids.has(c.cover)
        ? c.cover
        : data.images.find((im) => im.category === c.id)?.id,
    }));
    data.families = data.families.map((f) => ({
      ...f,
      cover: ids.has(f.cover)
        ? f.cover
        : data.images.find((im) => im.family === f.id)?.id,
      subcategories: f.subcategories.map(
        (c) => data.categories.find((x) => x.id === c.id) || c,
      ),
    }));
    return data;
  },
};
