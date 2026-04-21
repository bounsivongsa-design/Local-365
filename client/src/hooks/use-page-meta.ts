import { useEffect } from "react";

/**
 * Updates document.title and the description / Open Graph meta tags so each
 * page (and each location context) gets a unique, indexable title. Idempotent:
 * if the meta tags don't exist, they're created on first call.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      ensureMeta("description", description);
      ensureMeta("og:title", title, "property");
      ensureMeta("og:description", description, "property");
      ensureMeta("twitter:title", title);
      ensureMeta("twitter:description", description);
    }
  }, [title, description]);
}

function ensureMeta(key: string, value: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}
