// Solar position after the NOAA / SunCalc formulation (Agafonkin, BSD-2).
const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
const OBLIQUITY = RAD * 23.4397;

const toDays = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const meanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (M: number) =>
  M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
const declination = (L: number) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, M: number, L: number) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

export type SunTimes = { civilDawn: Date; sunrise: Date; sunset: Date; civilDusk: Date };

export function sunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const n = Math.round(toDays(date) - J0 - lw / (2 * Math.PI));
  const ds = approxTransit(0, lw, n);
  const M = meanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const noon = solarTransitJ(ds, M, L);
  const pair = (altDeg: number) => {
    const w = Math.acos((Math.sin(altDeg * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const set = solarTransitJ(approxTransit(w, lw, n), M, L);
    return { rise: fromJulian(noon - (set - noon)), set: fromJulian(set) };
  };
  const official = pair(-0.833);
  const civil = pair(-6);
  return { civilDawn: civil.rise, sunrise: official.rise, sunset: official.set, civilDusk: civil.set };
}

export type LightCondition = "day" | "civil-twilight" | "night";

export function lightCondition(at: Date, lat: number, lng: number): LightCondition {
  const t = sunTimes(at, lat, lng);
  if (at >= t.sunrise && at <= t.sunset) return "day";
  if (at >= t.civilDawn && at <= t.civilDusk) return "civil-twilight";
  return "night";
}
