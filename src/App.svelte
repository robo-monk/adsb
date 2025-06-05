<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Counter from "./lib/Counter.svelte";
  import { processIncomingAircraftSignal, aircrafts } from "./lib.svelte";

  // connect to ws at ws://192.87.172.71:1338
  const ws = new WebSocket("ws://192.87.172.71:1338");

  ws.onmessage = (event) => {
    processIncomingAircraftSignal(event.data)
  };

  onDestroy(() => {
    ws.close();
  });
</script>

<main>
  <h1>Aircraft count: {aircrafts.size}</h1>
  <div class="relative w-[90vw] h-[90vh] bg-red-500">
    {#each aircrafts.values() as aircraft}
      <div class="absolute" style="left: {aircraft.longitude}%; top: {aircraft.latitude}%;">
        <h2>{aircraft.address}</h2>
      </div>
    {/each}
  </div>
</main>
