const ZIP_COORDS: Record<string, [number, number]> = {
  "27958": [36.5224, -76.1785],
  "27929": [36.3596, -75.9232],
  "27949": [36.1885, -75.7579],
  "27927": [36.3766, -75.8310],
  "27948": [36.0307, -75.6713],
  "27959": [35.9582, -75.6249],
  "27954": [35.9087, -75.6757],
  "27947": [36.3020, -75.9650],
  "27956": [36.4063, -76.0200],
  "27966": [36.2520, -75.8830],
  "23322": [36.6799, -76.2373],
  "23321": [36.7530, -76.3140],
  "23320": [36.7190, -76.2360],
  "23323": [36.6800, -76.3050],
  "23324": [36.8070, -76.2880],
  "23325": [36.7710, -76.2600],
  "23456": [36.7370, -76.0360],
  "23457": [36.6160, -76.0230],
  "23462": [36.8380, -76.1510],
  "23464": [36.8010, -76.1870],
  "27950": [36.5000, -75.9700],
  "27923": [36.3200, -76.1700],
  "27917": [36.3500, -76.2300],
  "27916": [36.3000, -76.0500],
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
