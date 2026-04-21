import type { SelectedLocation } from "@/context/LocationContext";

/**
 * Centralized region-aware copy helpers. Use these instead of hardcoding
 * "Moyock, NC" / "Currituck County" anywhere user-visible. Each helper accepts
 * the active SelectedLocation (from useLocation()) and falls back gracefully
 * when fields are missing.
 */

export function cityState(loc: SelectedLocation): string {
  return `${loc.city}, ${loc.state}`;
}

export function regionLabel(loc: SelectedLocation): string {
  // Prefer the curated region tag (e.g. "Outer Banks", "Hampton Roads"),
  // otherwise fall back to "<City> area".
  return loc.region && loc.region.trim() ? loc.region : `${loc.city} area`;
}

export function directoryTagline(loc: SelectedLocation): string {
  return `Your trusted community directory for ${cityState(loc)}.`;
}

export function pageTitle(loc: SelectedLocation, leaf?: string): string {
  const base = `Local List 365 — ${cityState(loc)}`;
  return leaf ? `${leaf} | ${base}` : base;
}

export function metaDescription(loc: SelectedLocation): string {
  return `Find trusted local businesses, events, and services in ${cityState(loc)}${
    loc.region ? ` (${loc.region})` : ""
  }. Connect with verified pros, post a project, and discover what's happening nearby.`;
}
