export type SpeedReading = {
  speedKmh: number | null;
  accuracy: number | null;
  source: "sensor" | "calculated" | "unavailable";
  lastUpdated: number | null;
};

export type LocationPermission = "prompt" | "granted" | "denied" | "unavailable";

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speedKmh: number | null;
  speedSource: SpeedReading["source"];
  timestamp: number;
  source: "device" | "demo";
};

type Point = { latitude: number; longitude: number; time: number; accuracy: number };

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceMetres = (a: Point, b: Point) => {
  const radius = 6371e3;
  const lat = toRad(b.latitude - a.latitude);
  const lng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(lng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export class SpeedSmoother {
  private points: Point[] = [];
  private speeds: number[] = [];

  add(position: GeolocationPosition): SpeedReading {
    const point: Point = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      time: position.timestamp,
    };

    let speed: number | null = null;
    let source: SpeedReading["source"] = "unavailable";

    if (position.coords.accuracy <= 80 && position.coords.speed != null && position.coords.speed >= 0) {
      speed = position.coords.speed * 3.6;
      source = "sensor";
    } else if (position.coords.accuracy <= 80 && this.points.length) {
      const previous = this.points[this.points.length - 1];
      const seconds = (point.time - previous.time) / 1000;
      if (seconds >= 2) {
        const calculated = (distanceMetres(previous, point) / seconds) * 3.6;
        if (calculated >= 0 && calculated < 180) {
          speed = calculated;
          source = "calculated";
        }
      }
    }

    this.points = [...this.points.slice(-3), point];
    if (speed != null) this.speeds = [...this.speeds.slice(-4), speed];
    const smoothed = this.speeds.length
      ? this.speeds.reduce((total, value) => total + value, 0) / this.speeds.length
      : null;

    return {
      speedKmh: smoothed == null ? null : Math.round(smoothed),
      accuracy: Math.round(position.coords.accuracy),
      source,
      lastUpdated: Date.now(),
    };
  }
}

export const snapshotPosition = (
  position: GeolocationPosition,
  reading: SpeedReading,
): DeviceLocation => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: Math.round(position.coords.accuracy),
  heading: position.coords.heading,
  speedKmh: reading.speedKmh,
  speedSource: reading.source,
  timestamp: position.timestamp || Date.now(),
  source: "device",
});
