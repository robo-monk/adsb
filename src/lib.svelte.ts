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
  hidden?: boolean;
};

export const receiverBitrates = new SvelteMap<AircraftSignal["receiver"], number>();

// export const aircrafts = new SvelteMap<AircraftAddress, AircraftSignal>();
export const aircrafts = $state<Record<AircraftAddress, AircraftSignal>>({})
// export const aircrafts = new SvelteMap<AircraftAddress, AircraftSignal>();

// Bitrate tracking variables
const receiverSignalCounts = new Map<AircraftSignal["receiver"], number>();
const receiverLastResetTime = new Map<AircraftSignal["receiver"], number>();
const BITRATE_WINDOW_MS = 500; // Calculate bitrate over 5-second windows

// Initialize bitrate tracking for known receivers
const knownReceivers: AircraftSignal["receiver"][] = ["zi-5067", "zi-5110"];
knownReceivers.forEach(receiver => {
  receiverSignalCounts.set(receiver, 0);
  receiverLastResetTime.set(receiver, Date.now());
  receiverBitrates.set(receiver, 0);
});

function updateReceiverBitrate(receiver: AircraftSignal["receiver"]) {
  const now = Date.now();
  const lastReset = receiverLastResetTime.get(receiver) || now;
  const timeElapsed = now - lastReset;
  
  // Update bitrate every BITRATE_WINDOW_MS milliseconds
  if (timeElapsed >= BITRATE_WINDOW_MS) {
    const signalCount = receiverSignalCounts.get(receiver) || 0;
    const bitrate = (signalCount / timeElapsed) * 1000; // signals per second
    
    receiverBitrates.set(receiver, Math.round(bitrate * 100) / 100); // Round to 2 decimal places
    receiverSignalCounts.set(receiver, 0);
    receiverLastResetTime.set(receiver, now);
  }
}

let currentTimestamp = Date.now();

// if the signal is not recieved for more than Xseconds drop it
const DROP_IF_BEFORE = 30 * 1000; // 10 seconds
let lastGcRun = Date.now();
function garbageCollection() {
  if (Date.now() - lastGcRun < DROP_IF_BEFORE/8) return;
  lastGcRun = Date.now();
  // aircrafts.forEach((aircraft, key) => {
  Object.entries(aircrafts).forEach(([key, aircraft]) => {
    console.log(currentTimestamp - aircraft.timestamp)
    if (aircraft.timestamp && currentTimestamp - aircraft.timestamp > DROP_IF_BEFORE) {
      console.debug("[X] DROPPING", key);
      // aircrafts.delete(key);
      // aircraft.hidden = true;
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
    hidden: false,
  };

  if (!signal.address) return null;

  // Update receiver bitrate tracking
  if (signal.receiver) {
    const currentCount = receiverSignalCounts.get(signal.receiver) || 0;
    receiverSignalCounts.set(signal.receiver, currentCount + 1);
    updateReceiverBitrate(signal.receiver);
  }

  const key = `${signal.address}-${signal.receiver}`;
  if (aircrafts[key]) {
    // update fields that are not null
    const aircraft = aircrafts[key];

    if (signal.receiver) aircraft.receiver = signal.receiver;
    if (signal.altitude) aircraft.altitude = signal.altitude;
    if (signal.latitude) aircraft.latitude = signal.latitude;
    if (signal.longitude) aircraft.longitude = signal.longitude;
    if (signal.timestamp) aircraft.timestamp = signal.timestamp;
    if (signal.rssi) aircraft.rssi = signal.rssi;
    if (signal.heading) aircraft.heading = signal.heading;
    if (signal.speed) aircraft.speed = signal.speed;
    
    // aircraft.hidden = false;
    aircrafts[key] = aircraft;
  } else {
    aircrafts[key] = signal as AircraftSignal;
  }
  return signal;
}
