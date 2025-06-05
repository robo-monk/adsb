import { SvelteMap } from "svelte/reactivity";

type AircraftAddress = string;
type AircraftSignal = {
  address: AircraftAddress;
  altitude: number;
  latitude: number;
  longitude: number;
  timestamp: number; // unix timestamp
  rssi: number;
  receiver: "zi-5067" | "zi-5110";
  heading: number;
  speed: number;
};

export const aircrafts = new SvelteMap<AircraftAddress, AircraftSignal>();
// export const aircrafts = new SvelteMap<AircraftAddress, AircraftSignal>();

let currentTimestamp = Date.now();

// if the signal is not recieved for more than Xseconds drop it
const DROP_IF_BEFORE = 30 * 1000; // 10 seconds
let lastGcRun = Date.now();
function garbageCollection() {
  if (Date.now() - lastGcRun < 500) return;
  lastGcRun = Date.now();
  aircrafts.forEach((aircraft, key) => {
    console.log(currentTimestamp - aircraft.timestamp)
    if (aircraft.timestamp && currentTimestamp - aircraft.timestamp > DROP_IF_BEFORE) {
      console.debug("[X] DROPPING", key);
      aircrafts.delete(key);
    }
  });
}

export function processIncomingAircraftSignal(json: string) {
  // console.debug("processing")
  garbageCollection();
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

  currentTimestamp =  Date.parse(obj.timestamp).valueOf()
  // console.log("currentTimestamp", currentTimestamp)

  const signal: Partial<AircraftSignal> = {
    address: obj.address,
    altitude: obj.altitude,
    latitude: obj.latitude,
    longitude: obj.longitude,
    timestamp: currentTimestamp,
    rssi: obj.rssi,
    receiver: obj.receiver,
    heading: obj.heading,
    speed: obj.speed,
  };

  if (!signal.address) return null;


  const key = `${signal.address}-${signal.receiver}`;
  if (aircrafts.has(key)) {
    // update fields that are not null
    const aircraft = aircrafts.get(key)!;

    if (signal.receiver) aircraft.receiver = signal.receiver;
    if (signal.altitude) aircraft.altitude = signal.altitude;
    if (signal.latitude) aircraft.latitude = signal.latitude;
    if (signal.longitude) aircraft.longitude = signal.longitude;
    if (signal.timestamp) aircraft.timestamp = signal.timestamp;
    if (signal.rssi) aircraft.rssi = signal.rssi;
    if (signal.heading) aircraft.heading = signal.heading;
    if (signal.speed) aircraft.speed = signal.speed;

    aircrafts.set(key, aircraft);
  } else {
    aircrafts.set(key, signal as AircraftSignal);
  }
  // return signal;
}
