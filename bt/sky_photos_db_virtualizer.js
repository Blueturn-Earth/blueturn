const GEO_CLUSTERS = [
  // North America
  { lat: 40.7128, lon: -74.0060 }, // NYC
  { lat: 34.0522, lon: -118.2437 }, // LA
  { lat: 37.7749, lon: -122.4194 }, // SF

  // Europe
  { lat: 48.8566, lon: 2.3522 }, // Paris
  { lat: 51.5074, lon: -0.1278 }, // London
  { lat: 52.5200, lon: 13.4050 }, // Berlin
  { lat: 41.9028, lon: 12.4964 }, // Rome

  // Middle East
  { lat: 32.0853, lon: 34.7818 }, // Tel Aviv
  { lat: 31.7683, lon: 35.2137 }, // Jerusalem

  // Asia
  { lat: 35.6895, lon: 139.6917 }, // Tokyo
  { lat: 37.5665, lon: 126.9780 }, // Seoul
  { lat: 31.2304, lon: 121.4737 }, // Shanghai
  { lat: 28.6139, lon: 77.2090 }, // Delhi

  // South America
  { lat: -23.5505, lon: -46.6333 }, // São Paulo
  { lat: -34.6037, lon: -58.3816 }, // Buenos Aires

  // Africa
  { lat: -1.2921, lon: 36.8219 }, // Nairobi
  { lat: 30.0444, lon: 31.2357 }, // Cairo

  // Oceania
  { lat: -33.8688, lon: 151.2093 } // Sydney
];

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickClusterIndex(virtualId) {
  const r = pseudoRandom(virtualId);

  // 90% clustered, 10% random anywhere
  if (r < 0.9) {
    return Math.floor(
      pseudoRandom(virtualId * 17) * GEO_CLUSTERS.length
    );
  }

  return -1; // random global point
}

function generateRandomGPS(virtualId) {
  const clusterIndex = pickClusterIndex(virtualId);

  // Local jitter in degrees
  const localRadiusKm = 5; // city-scale
  const metersToDegrees = 1 / 111_320;

  if (clusterIndex >= 0) {
    const center = GEO_CLUSTERS[clusterIndex];

    const angle =
      pseudoRandom(virtualId * 31) * 2 * Math.PI;
    const distanceKm =
      Math.pow(pseudoRandom(virtualId * 57), 2) *
      localRadiusKm;

    const dx = Math.cos(angle) * distanceKm;
    const dy = Math.sin(angle) * distanceKm;

    return {
      lat: center.lat + dy * metersToDegrees * 1000,
      lon:
        center.lon +
        dx *
          metersToDegrees *
          1000 /
          Math.cos((center.lat * Math.PI) / 180)
    };
  }

  // Global random (oceans, deserts, etc.)
  return {
    lat: pseudoRandom(virtualId * 101) * 180 - 90,
    lon: pseudoRandom(virtualId * 103) * 360 - 180
  };
}

const DEC_2025_START = Date.UTC(2025, 11, 1, 0, 0, 0);
const DEC_2025_END   = Date.UTC(2026, 0, 1, 0, 0, 0);
const DEC_2025_SPAN  = DEC_2025_END - DEC_2025_START;

function pickDecemberDay(virtualId) {
  let t = pseudoRandom(virtualId * 13);

  // Strong Christmas bias (Dec 24–26)
  const christmasPeak =
    Math.exp(-Math.pow(t - 0.80, 2) / 0.002);

  t = Math.min(1, t + christmasPeak * 0.35);

  const millis =
    DEC_2025_START + t * DEC_2025_SPAN;

  return new Date(millis);
}

function pickLocalHour(virtualId) {
  const r = pseudoRandom(virtualId * 29);

  // 90% daytime
  if (r < 0.90) {
    return 8 + Math.floor(
      pseudoRandom(virtualId * 31) * 10
    ); // 08–18
  }

  // 9% twilight
  if (r < 0.99) {
    return pseudoRandom(virtualId * 37) < 0.5
      ? 6 + Math.floor(pseudoRandom(virtualId * 41) * 2) // 06–07
      : 18 + Math.floor(pseudoRandom(virtualId * 43) * 3); // 18–20
  }

  // 1% true night
  return pseudoRandom(virtualId * 47) < 0.5
    ? Math.floor(pseudoRandom(virtualId * 53) * 5)       // 00–04
    : 22 + Math.floor(pseudoRandom(virtualId * 59) * 2); // 22–23
}

function localToUTC(date, lat, lon, localHour, virtualId) {
  const tzOffsetHours = Math.round(lon / 15);

  const d = new Date(date);
  d.setUTCHours(
    localHour - tzOffsetHours,
    Math.floor(pseudoRandom(virtualId * 61) * 60),
    Math.floor(pseudoRandom(virtualId * 67) * 60)
  );

  return d;
}

function generateRandomTimestamp(timestamp, virtualId, gps)
{
  const baseDay = pickDecemberDay(virtualId);
  const localHour = pickLocalHour(virtualId);

  return localToUTC(
    baseDay,
    gps.lat,
    gps.lon,
    localHour,
    virtualId
  );
}

export function virtualizeSkyPhoto(picItem, virtualId) {
  const gps = generateRandomGPS(picItem.gps, virtualId);

  return {
    ...picItem,
    virtualId,
    gps,
    takenTime: generateRandomTimestamp(picItem.takenTime || picItem.createdAt, virtualId, gps),
    image: {
      ...picItem.image,
      imageUrl: `${picItem.image.imageUrl}&v=${virtualId}`,
      thumbnailUrl: `${picItem.image.thumbnailUrl}&v=${virtualId}`
    }
  };
}
