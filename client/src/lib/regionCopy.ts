import type { SelectedLocation } from "@/context/LocationContext";

/**
 * Centralized region-aware copy helpers. Use these instead of hardcoding
 * "Moyock, NC" / "Currituck County" anywhere user-visible. Each helper accepts
 * the active SelectedLocation (from useLocation()) and falls back gracefully
 * when fields are missing.
 */

/** Returns true when the user has actually picked a real location (city + state). */
function hasLocation(loc: SelectedLocation): boolean {
  return !!(loc.city && loc.state && loc.city !== "your area");
}

export function cityState(loc: SelectedLocation): string {
  if (!hasLocation(loc)) return "your area";
  return `${loc.city}, ${loc.state}`;
}

export function regionLabel(loc: SelectedLocation): string {
  // Prefer the curated region tag (e.g. "Outer Banks", "Hampton Roads"),
  // otherwise fall back to "<City> area" or "your area" if not set yet.
  if (!hasLocation(loc)) return "your area";
  return loc.region && loc.region.trim() ? loc.region : `${loc.city} area`;
}

export function directoryTagline(loc: SelectedLocation): string {
  if (!hasLocation(loc)) {
    return "Your trusted community directory across NC's Outer Banks & Elizabeth City and VA's Hampton Roads.";
  }
  return `Your trusted community directory for ${cityState(loc)}.`;
}

export function footerTagline(loc: SelectedLocation): string {
  if (!hasLocation(loc)) {
    return "Your trusted community directory across NC's Outer Banks & Elizabeth City and VA's Hampton Roads. Connecting neighbors, supporting local businesses, and celebrating community life every single day.";
  }
  return `Your trusted community directory for ${cityState(loc)}${
    loc.region ? ` (${loc.region})` : ""
  }. Connecting neighbors, supporting local businesses, and celebrating community life every single day.`;
}

export function pageTitle(loc: SelectedLocation, leaf?: string): string {
  const base = hasLocation(loc) ? `Local List 365 — ${cityState(loc)}` : "Local List 365";
  return leaf ? `${leaf} | ${base}` : base;
}

export function metaDescription(loc: SelectedLocation): string {
  if (!hasLocation(loc)) {
    return "Find trusted local businesses, events, and services across NC's Outer Banks, Elizabeth City, and VA's Hampton Roads. Connect with verified pros, post a project, and discover what's happening nearby.";
  }
  return `Find trusted local businesses, events, and services in ${cityState(loc)}${
    loc.region ? ` (${loc.region})` : ""
  }. Connect with verified pros, post a project, and discover what's happening nearby.`;
}
