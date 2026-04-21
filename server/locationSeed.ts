import { db as pgDb } from "./db";
import { locations } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Seed data for Task #11 — one row per ZIP code covering NC OBX/Elizabeth City
 * + VA Chesapeake/Virginia Beach. Lat/long figures are USPS centroid
 * approximations (rounded to 4 decimals — ~10m accuracy, good enough for
 * radius-based directory search). Slug is derived from city+zip so it stays
 * unique across same-named cities (e.g. multiple Chesapeake zips).
 */
export interface SeedZip {
  zipCode: string;
  city: string;
  state: "NC" | "VA";
  region: string;
  tagline: string;
  latitude: number;
  longitude: number;
}

export const SEED_ZIPS: SeedZip[] = [
  // NC — Currituck County
  { zipCode: "27958", city: "Moyock", state: "NC", region: "Currituck County", tagline: "Heart of Currituck County", latitude: 36.5224, longitude: -76.1785 },
  { zipCode: "27929", city: "Currituck", state: "NC", region: "Currituck County", tagline: "County seat with coastal charm", latitude: 36.4459, longitude: -76.0133 },
  { zipCode: "27917", city: "Barco", state: "NC", region: "Currituck County", tagline: "Central Currituck community", latitude: 36.3831, longitude: -76.0594 },
  { zipCode: "27916", city: "Aydlett", state: "NC", region: "Currituck County", tagline: "Quiet waterfront living", latitude: 36.3333, longitude: -75.9456 },
  { zipCode: "27923", city: "Coinjock", state: "NC", region: "Currituck County", tagline: "Famous for steak and the Intracoastal", latitude: 36.3535, longitude: -75.9499 },
  { zipCode: "27927", city: "Corolla", state: "NC", region: "Outer Banks", tagline: "Historic lighthouse and wild horse tours", latitude: 36.3762, longitude: -75.8302 },
  { zipCode: "27939", city: "Grandy", state: "NC", region: "Currituck County", tagline: "Southern Currituck gateway", latitude: 36.2403, longitude: -75.8794 },
  { zipCode: "27941", city: "Harbinger", state: "NC", region: "Currituck County", tagline: "Sound-side living near the bridge", latitude: 36.0907, longitude: -75.7905 },
  { zipCode: "27947", city: "Jarvisburg", state: "NC", region: "Currituck County", tagline: "Currituck wine country", latitude: 36.2076, longitude: -75.8810 },
  { zipCode: "27950", city: "Knotts Island", state: "NC", region: "Currituck County", tagline: "Island community and nature preserve", latitude: 36.5118, longitude: -75.9760 },
  { zipCode: "27956", city: "Maple", state: "NC", region: "Currituck County", tagline: "Rural Currituck living", latitude: 36.4015, longitude: -76.0197 },
  { zipCode: "27964", city: "Point Harbor", state: "NC", region: "Currituck County", tagline: "Waterfront community on the sound", latitude: 36.0795, longitude: -75.7867 },
  { zipCode: "27965", city: "Poplar Branch", state: "NC", region: "Currituck County", tagline: "Peaceful Currituck countryside", latitude: 36.2877, longitude: -75.9377 },
  { zipCode: "27966", city: "Powells Point", state: "NC", region: "Currituck County", tagline: "Sound-front living south of Currituck", latitude: 36.1437, longitude: -75.8316 },
  { zipCode: "27973", city: "Shawboro", state: "NC", region: "Currituck County", tagline: "Historic Currituck countryside", latitude: 36.4082, longitude: -76.1582 },
  { zipCode: "27921", city: "Camden", state: "NC", region: "Camden County", tagline: "Quiet small-town living near Elizabeth City", latitude: 36.3271, longitude: -76.1716 },
  // NC — Pasquotank / Elizabeth City + Dare County (OBX)
  { zipCode: "27909", city: "Elizabeth City", state: "NC", region: "Pasquotank County", tagline: "Historic harbor of the Pasquotank", latitude: 36.2946, longitude: -76.2510 },
  { zipCode: "27949", city: "Kitty Hawk", state: "NC", region: "Outer Banks", tagline: "Where flight began", latitude: 36.0644, longitude: -75.7055 },
  { zipCode: "27948", city: "Kill Devil Hills", state: "NC", region: "Outer Banks", tagline: "Heart of the Outer Banks", latitude: 36.0307, longitude: -75.6713 },
  { zipCode: "27953", city: "Manns Harbor", state: "NC", region: "Dare County", tagline: "Mainland gateway to Roanoke Island", latitude: 35.9018, longitude: -75.7841 },
  { zipCode: "27954", city: "Manteo", state: "NC", region: "Outer Banks", tagline: "Historic seat of Dare County", latitude: 35.9082, longitude: -75.6757 },
  { zipCode: "27959", city: "Nags Head", state: "NC", region: "Outer Banks", tagline: "Classic Outer Banks beach town", latitude: 35.9579, longitude: -75.6249 },
  { zipCode: "27981", city: "Wanchese", state: "NC", region: "Outer Banks", tagline: "Working waterfront on Roanoke Island", latitude: 35.8424, longitude: -75.6363 },
  // VA — Chesapeake (6)
  { zipCode: "23320", city: "Chesapeake", state: "VA", region: "Hampton Roads", tagline: "Greenbrier and central Chesapeake", latitude: 36.7190, longitude: -76.2360 },
  { zipCode: "23321", city: "Chesapeake", state: "VA", region: "Hampton Roads", tagline: "Western Branch and Churchland", latitude: 36.8463, longitude: -76.4338 },
  { zipCode: "23322", city: "Chesapeake", state: "VA", region: "Hampton Roads", tagline: "Great Bridge and southern Chesapeake", latitude: 36.6799, longitude: -76.2373 },
  { zipCode: "23323", city: "Chesapeake", state: "VA", region: "Hampton Roads", tagline: "Bowers Hill and Deep Creek", latitude: 36.7886, longitude: -76.3778 },
  { zipCode: "23324", city: "Chesapeake", state: "VA", region: "Hampton Roads", tagline: "South Norfolk and Campostella", latitude: 36.8127, longitude: -76.2691 },
  { zipCode: "23325", city: "Chesapeake", state: "VA", region: "Hampton Roads", tagline: "Norfolk Highlands neighborhood", latitude: 36.7901, longitude: -76.2486 },
  // VA — Virginia Beach (12)
  { zipCode: "23451", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Oceanfront and resort district", latitude: 36.8466, longitude: -75.9783 },
  { zipCode: "23452", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Lynnhaven and Great Neck", latitude: 36.8385, longitude: -76.0944 },
  { zipCode: "23453", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Holland and Princess Anne", latitude: 36.7655, longitude: -76.0570 },
  { zipCode: "23454", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Birdneck and Red Mill area", latitude: 36.8195, longitude: -76.0312 },
  { zipCode: "23455", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Bayside and Pleasure House", latitude: 36.8893, longitude: -76.1429 },
  { zipCode: "23456", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Princess Anne and Courthouse", latitude: 36.7372, longitude: -76.0364 },
  { zipCode: "23457", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Pungo and southern farmland", latitude: 36.6160, longitude: -76.0230 },
  { zipCode: "23459", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Fort Story and Cape Henry", latitude: 36.9243, longitude: -76.0084 },
  { zipCode: "23460", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Naval Air Station Oceana", latitude: 36.8211, longitude: -76.0335 },
  { zipCode: "23461", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Dam Neck Naval annex", latitude: 36.8019, longitude: -75.9636 },
  { zipCode: "23462", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Pembroke Town Center area", latitude: 36.8380, longitude: -76.1510 },
  { zipCode: "23464", city: "Virginia Beach", state: "VA", region: "Hampton Roads", tagline: "Kempsville district", latitude: 36.8010, longitude: -76.1870 },
];

function makeSlug(z: SeedZip): string {
  const cityPart = z.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${cityPart}-${z.zipCode}`;
}

/**
 * Idempotent seeder. Inserts any zips from `SEED_ZIPS` that are not already in
 * the `locations` table (matched by slug). Safe to call on every server boot.
 * Existing rows are NOT mutated, so manual edits the admin makes (e.g. custom
 * tagline) survive subsequent boots.
 */
export async function seedServiceAreas(): Promise<{ inserted: number; existing: number }> {
  // Pull existing slugs in one query, then filter the seed list in-memory and
  // do a single batch insert if anything is missing.
  const existing = await pgDb.execute(sql`select slug from locations where slug is not null`);
  const existingSlugs = new Set<string>((existing.rows as Array<{ slug: string }>).map((r) => r.slug));

  const toInsert = SEED_ZIPS
    .map((z) => ({ ...z, slug: makeSlug(z) }))
    .filter((z) => !existingSlugs.has(z.slug));

  if (toInsert.length === 0) {
    return { inserted: 0, existing: existingSlugs.size };
  }

  await pgDb
    .insert(locations)
    .values(
      toInsert.map((z) => ({
        name: `${z.city}, ${z.state}`,
        city: z.city,
        state: z.state,
        zipCodes: [z.zipCode],
        region: z.region,
        tagline: z.tagline,
        latitude: String(z.latitude),
        longitude: String(z.longitude),
        slug: z.slug,
        isActive: true,
      })),
    )
    // Race-safe against concurrent boots: the partial unique index on `slug`
    // (locations_slug_unique) is the source of truth, so let Postgres ignore
    // duplicates rather than throwing.
    .onConflictDoNothing({ target: locations.slug });

  return { inserted: toInsert.length, existing: existingSlugs.size };
}
