<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    processIncomingAircraftSignal,
    aircrafts,
    receiverBitrates,
  } from "./lib.svelte";
  // import bigass from "./bigadsb.jsonl?raw";
  import bigass from "./out-ads-b.jsonl?raw";

  let cursor = 0;
  const entries = bigass
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  // .map((s) => JSON.parse(s.trim()));

  const FFWD_FACTOR = 0.001; // 1 is realtime, 0.1 is 10x faster, 0.01 is 100x faster

  let outOfData = $state(false);

  let lastTimestamp = Date.parse(entries[0]).valueOf();
  function next() {
    const entry = entries[cursor++];
    if (entry) {
      const signal = processIncomingAircraftSignal(entry);
      if (signal) {
        setTimeout(next, (signal.timestamp! - lastTimestamp) * FFWD_FACTOR);
        lastTimestamp = signal.timestamp!;
      }
    } else {
      outOfData = true;
    }
  }

  // next();

  // connect to ws at ws://192.87.172.71:1338
  const ws = new WebSocket("ws://192.87.172.71:1338");

  ws.onmessage = (event) => {
    processIncomingAircraftSignal(event.data)
  };

  onDestroy(() => {
    ws.close();
  });
</script>

<main class="relative">
  <div class="relative w-[100vw] h-[100vh] bg-black">
    {#if outOfData}
      <div
        class="absolute top-0 left-0 w-full h-full bg-red-800 flex items-center justify-center backdrop-blur-sm z-10"
      >
        <div class="text-red-500 text-2xl font-bold">Out of data</div>
      </div>
    {/if}
    <div class="flex gap-4 absolute top-0 right-0 p-4 flex-col">
      <div class="text-white text-xs">
        Aircraft count: {Object.keys(aircrafts).length}
        In range: {Object.values(aircrafts).filter((aircraft) => !aircraft.hidden).length}
      </div>
      <div class="text-red-500 font-mono text-xs">
        zi-5067: {receiverBitrates.get("zi-5067")?.toFixed(2) || 0} signals/sec
      </div>
      <div class="text-blue-500 font-mono text-xs">
        zi-5110: {receiverBitrates.get("zi-5110")?.toFixed(2) || 0} signals/sec
      </div>
    </div>
    {#each Object.values(aircrafts) as aircraft}

      {@const maxRssi = Object.values(aircrafts).reduce((max, aircraft) => Math.max(max, aircraft.rssi), 0)}
      {@const minRssi = Object.values(aircrafts).reduce((min, aircraft) => Math.min(min, aircraft.rssi), 0)}
      {@const rssi = aircraft.rssi - minRssi}
      {@const rssiPercentage = rssi / (maxRssi - minRssi)}
      {#if !aircraft.hidden}
        <div
          class="absolute flex flex-col items-center justify-center transition-all duration-200"
          style="left: {(aircraft.longitude * 10 - 40) *
            2}%; top: {(aircraft.latitude - 50) * 20}%;
            opacity: {rssiPercentage};
            "
        >
          <span class="text-white text-xs">{aircraft.address}</span>
          <div
            class="w-2 h-2 {aircraft.receiver === 'zi-5067'
              ? 'bg-red-500'
              : 'bg-blue-500'} rounded-full relative"
            style="transform: rotateZ({aircraft.heading}deg);
            "
          >
            <div
              class="w-[1px] h-2 bg-white absolute left-1/2 -translate-x-1/2 -translate-y-[100%]"
            ></div>
            <div class="text-white text-xs -rotate-90">✈</div>
          </div>
          <!-- <span class="text-white text-xs">{aircraft.address}</span> -->
          <span class="text-white text-xs">{aircraft.altitude}m</span>
          <!-- <span class="text-white text-xs">{aircraft.receiver}</span> -->
        </div>
      {/if}
    {/each}
  </div>
</main>
