import { SvelteMap } from "svelte/reactivity";

type AircraftAddress = string;
type AircraftSignal = {
  address: AircraftAddress;
  altitude: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  rssi: number;
  receiver: string;
  heading: number;
  speed: number;
};

export const aircrafts = new SvelteMap<AircraftAddress, AircraftSignal>();

export function processIncomingAircraftSignal(json: string) {
  let obj: any;

  try {
    obj = JSON.parse(json);
  } catch (err) {
    return null; // Return null instead of throwing an exception
  }
  

  // Optional: validate timestamp format (basic ISO 8601)
  if (isNaN(Date.parse(obj.timestamp))) {
    return null; // Return null instead of throwing an exception
  }

  const signal: Partial<AircraftSignal> = {
    address: obj.address,
    altitude: obj.altitude,
    latitude: obj.latitude,
    longitude: obj.longitude,
    timestamp: obj.timestamp,
    rssi: obj.rssi,
    receiver: obj.receiver,
    heading: obj.heading,
    speed: obj.speed,
  };

  if (!signal.address) return null;

  if (aircrafts.has(signal.address)) {
    // update fields that are not null
    const aircraft = aircrafts.get(signal.address)!;

    if (signal.altitude) aircraft.altitude = signal.altitude;
    if (signal.latitude) aircraft.latitude = signal.latitude;
    if (signal.longitude) aircraft.longitude = signal.longitude;
    if (signal.timestamp) aircraft.timestamp = signal.timestamp;
    if (signal.rssi) aircraft.rssi = signal.rssi;
    if (signal.receiver) aircraft.receiver = signal.receiver;
    if (signal.heading) aircraft.heading = signal.heading;
    if (signal.speed) aircraft.speed = signal.speed;

    aircrafts.set(signal.address, aircraft);
  } else {
    aircrafts.set(signal.address, signal as AircraftSignal);
  }
  // return signal;
}
