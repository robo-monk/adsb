<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    processIncomingAircraftSignal,
    aircrafts,
    receiverBitrates,
  } from "./lib.svelte";
  import bigass from "./bigadsb.jsonl?raw";
  // import bigass from "./out-ads-b.jsonl?raw";

  let cursor = 0;
  const entries = bigass
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  // .map((s) => JSON.parse(s.trim()));

  const FFWD_FACTOR = 1; // 1 is realtime, 0.1 is 10x faster, 0.01 is 100x faster

  let outOfData = $state(false);

  // Map view state
  let centerLat = $state(51.920); // Initial center latitude
  let centerLon = $state(5.92);  // Initial center longitude
  let zoomLevel = $state(3);    // Initial zoom level (higher = more zoomed in)
  
  // Screen dimensions
  let screenWidth = $state(0);
  let screenHeight = $state(0);

  // Coordinate conversion functions
  function latLonToScreen(lat: number, lon: number) {
    // Return off-screen coordinates for invalid lat/lon
    if (isNaN(lat) || isNaN(lon) || lat == null || lon == null) {
      return { x: -1000, y: -1000 };
    }
    
    // Convert lat/lon to screen coordinates with proper scaling
    const scale = Math.pow(2, zoomLevel);
    
    // Calculate degrees per pixel based on zoom level
    // At zoom level 1, we want to show roughly 10 degrees of lat/lon
    const degreesPerPixel = 10 / (Math.min(screenWidth, screenHeight) * scale);
    
    // Convert longitude to x
    const x = ((lon - centerLon) / degreesPerPixel) + screenWidth / 2;
    
    // Convert latitude to y (flip Y axis since screen coordinates go down)
    const y = ((centerLat - lat) / degreesPerPixel) + screenHeight / 2;
    
    return { x, y };
  }

  // Get coordinate bounds for debugging
  $effect(() => {
    const aircraftList = Object.values(aircrafts);
    if (aircraftList.length > 0) {
      const lats = aircraftList.map(a => a.latitude).filter(lat => !isNaN(lat) && lat != null);
      const lons = aircraftList.map(a => a.longitude).filter(lon => !isNaN(lon) && lon != null);
      if (lats.length > 0 && lons.length > 0) {
        console.log('Lat range:', Math.min(...lats).toFixed(6), 'to', Math.max(...lats).toFixed(6));
        console.log('Lon range:', Math.min(...lons).toFixed(6), 'to', Math.max(...lons).toFixed(6));
      }
    }
  });

  // Keyboard controls
  function handleKeydown(event: KeyboardEvent) {
    const panStep = 0.01 / Math.pow(2, zoomLevel - 5); // Adjust pan step based on zoom
    
    switch (event.key) {
      case 'ArrowUp':
        centerLat += panStep;
        event.preventDefault();
        break;
      case 'ArrowDown':
        centerLat -= panStep;
        event.preventDefault();
        break;
      case 'ArrowLeft':
        centerLon -= panStep;
        event.preventDefault();
        break;
      case 'ArrowRight':
        centerLon += panStep;
        event.preventDefault();
        break;
      case '+':
      case '=':
        zoomLevel = Math.min(zoomLevel + 1, 15);
        event.preventDefault();
        break;
      case '-':
        zoomLevel = Math.max(zoomLevel - 1, 1);
        event.preventDefault();
        break;
    }
  }

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

  onMount(() => {
    // Get initial screen dimensions
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    
    // Update screen dimensions on resize
    function handleResize() {
      screenWidth = window.innerWidth;
      screenHeight = window.innerHeight;
    }
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

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
  <div class="relative w-[100vw] h-[100vh] bg-black overflow-hidden">
    {#if outOfData}
      <div
        class="absolute top-0 left-0 w-full h-full bg-red-800 flex items-center justify-center backdrop-blur-sm z-10"
      >
        <div class="text-red-500 text-2xl font-bold">Out of data</div>
      </div>
    {/if}
    
    <!-- Controls info -->
    <div class="absolute top-0 left-0 p-4 text-white text-xs z-20 bg-black bg-opacity-50 rounded-br-lg">
      <div>Use arrow keys to pan</div>
      <div>Use +/- to zoom</div>
      <div>Center: {centerLat.toFixed(3)}, {centerLon.toFixed(3)}</div>
      <div>Zoom: {zoomLevel}</div>
      {#if Object.values(aircrafts).length > 0}
        {@const aircraftList = Object.values(aircrafts)}
        {@const lats = aircraftList.map(a => a.latitude).filter(lat => !isNaN(lat) && lat != null)}
        {@const lons = aircraftList.map(a => a.longitude).filter(lon => !isNaN(lon) && lon != null)}
        {#if lats.length > 0 && lons.length > 0}
          <div>Lat: {Math.min(...lats).toFixed(3)} to {Math.max(...lats).toFixed(3)}</div>
          <div>Lon: {Math.min(...lons).toFixed(3)} to {Math.max(...lons).toFixed(3)}</div>
        {:else}
          <div>No valid coordinates yet</div>
        {/if}
      {/if}
    </div>
    
    <!-- Stats -->
    <div class="flex gap-4 absolute top-0 right-0 p-4 flex-col z-20">
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
      {@const screenPos = latLonToScreen(aircraft.latitude, aircraft.longitude)}
      
      {#if !aircraft.hidden && screenPos.x >= -50 && screenPos.x <= screenWidth + 50 && screenPos.y >= -50 && screenPos.y <= screenHeight + 50}
        <div
          class="absolute flex flex-col items-center justify-center transition-all duration-200"
          style="left: {screenPos.x}px; top: {screenPos.y}px; transform: translate(-50%, -50%); opacity: {Math.max(0.1, rssiPercentage)};"
        >
          <!-- <span class="text-white text-xs">{aircraft.address}</span> -->
          <div
            class="w-2 h-2 {aircraft.receiver === 'zi-5067'
              ? 'bg-red-500'
              : 'bg-blue-500'} rounded-full relative"
            style="transform: rotateZ({aircraft.heading}deg);"
          >
            <div
              class="w-[1px] h-2 bg-white absolute left-1/2 -translate-x-1/2 -translate-y-[100%]"
            ></div>
            <div class="text-white text-xs -rotate-90">✈</div>
          </div>
          <!-- <span class="text-white text-xs">{aircraft.altitude}m</span> -->
        </div>
      {/if}
    {/each}
  </div>
</main>
