<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Counter from "./lib/Counter.svelte";
  import { processIncomingAircraftSignal, aircrafts } from "./lib.svelte";
  import bigass from "./bigadsb.jsonl?raw";

  let cursor = 0;
  const entries = bigass
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  // .map((s) => JSON.parse(s.trim()));
  let i = 0;
  const RATE = 1;

  onMount(() => {
    i = setInterval(() => {
      if (cursor < entries.length) {
        processIncomingAircraftSignal(entries[cursor++]);
      } else {
        // alert("cursor finished");
        cursor = 0;
      }
    }, RATE);
  });

  onDestroy(() => {
    clearInterval(i);
  });

  // connect to ws at ws://192.87.172.71:1338
  // const ws = new WebSocket("ws://192.87.172.71:1338");

  // ws.onmessage = (event) => {
  //   processIncomingAircraftSignal(event.data)
  // };

  // onDestroy(() => {
  //   ws.close();
  // });
</script>

<main>
  <h1>Aircraft count: {aircrafts.size}</h1>
  <div class="relative w-[100vw] h-[90vh] bg-black">
    {#each aircrafts.values() as aircraft}
      {@const maxRssi = aircrafts
        .values()
        .reduce((max, aircraft) => Math.max(max, aircraft.rssi), 0)}
      {@const minRssi = aircrafts
        .values()
        .reduce((min, aircraft) => Math.min(min, aircraft.rssi), 0)}
      {@const rssi = aircraft.rssi - minRssi}
      {@const rssiPercentage = rssi / (maxRssi - minRssi)}
      <div
        class="absolute flex flex-col items-center justify-center"
        style="left: {(aircraft.longitude * 10 - 50) *
          2}%; top: {(aircraft.latitude - 50) * 20}%; opacity: {rssiPercentage}"
      >
        <div
          class="w-2 h-2 bg-red-500 rounded-full relative"
          style="opacity: {rssiPercentage};transform: rotateZ({aircraft.heading}deg);"
        >
          <div
            class="w-[1px] h-2 bg-white absolute left-1/2 -translate-x-1/2 -translate-y-[100%]"
          ></div>
        </div>
        <!-- <span class="text-white text-xs">{aircraft.address}</span> -->
        <span class="text-white text-xs">{aircraft.altitude}m</span>
        <!-- <span class="text-white text-xs">{aircraft.receiver}</span> -->
      </div>
    {/each}
  </div>
</main>
