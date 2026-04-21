// Centroid coordinates for every zip the platform serves. Kept in sync with
// `server/locationSeed.ts` SEED_ZIPS — when adding a zip there, add it here.
const ZIP_COORDS: Record<string, [number, number]> = {
  // NC — Currituck / Camden
  "27958": [36.5224, -76.1785],
  "27929": [36.4459, -76.0133],
  "27917": [36.3831, -76.0594],
  "27916": [36.3333, -75.9456],
  "27923": [36.3535, -75.9499],
  "27927": [36.3762, -75.8302],
  "27939": [36.2403, -75.8794],
  "27941": [36.0907, -75.7905],
  "27947": [36.2076, -75.8810],
  "27950": [36.5118, -75.9760],
  "27956": [36.4015, -76.0197],
  "27964": [36.0795, -75.7867],
  "27965": [36.2877, -75.9377],
  "27966": [36.1437, -75.8316],
  "27973": [36.4082, -76.1582],
  "27921": [36.3271, -76.1716],
  // NC — Pasquotank / Dare
  "27909": [36.2946, -76.2510],
  "27949": [36.0644, -75.7055],
  "27948": [36.0307, -75.6713],
  "27953": [35.9018, -75.7841],
  "27954": [35.9082, -75.6757],
  "27959": [35.9579, -75.6249],
  "27981": [35.8424, -75.6363],
  // VA — Chesapeake
  "23320": [36.7190, -76.2360],
  "23321": [36.8463, -76.4338],
  "23322": [36.6799, -76.2373],
  "23323": [36.7886, -76.3778],
  "23324": [36.8127, -76.2691],
  "23325": [36.7901, -76.2486],
  // VA — Virginia Beach
  "23451": [36.8466, -75.9783],
  "23452": [36.8385, -76.0944],
  "23453": [36.7655, -76.0570],
  "23454": [36.8195, -76.0312],
  "23455": [36.8893, -76.1429],
  "23456": [36.7372, -76.0364],
  "23457": [36.6160, -76.0230],
  "23459": [36.9243, -76.0084],
  "23460": [36.8211, -76.0335],
  "23461": [36.8019, -75.9636],
  "23462": [36.8380, -76.1510],
  "23464": [36.8010, -76.1870],
};

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function getZipCoords(zip: string): [number, number] | null {
  return ZIP_COORDS[zip] || null;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getDistanceFromZips(zip1: string, zip2: string): number | null {
  const coords1 = getZipCoords(zip1);
  const coords2 = getZipCoords(zip2);
  if (!coords1 || !coords2) return null;
  return calculateDistance(coords1[0], coords1[1], coords2[0], coords2[1]);
}

export const RADIUS_OPTIONS = [
  { label: "Any Distance", value: 0 },
  { label: "5 miles", value: 5 },
  { label: "10 miles", value: 10 },
  { label: "25 miles", value: 25 },
  { label: "50 miles", value: 50 },
];
