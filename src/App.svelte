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

  // .map((s) => JSON.parse(s.trim()));

  const FFWD_FACTOR = 0.001; // 1 is realtime, 0.1 is 10x faster, 0.01 is 100x faster

  let outOfData = $state(false);

  // Map view state
  let centerLat = $state(52.32); // Initial center latitude
  let centerLon = $state(5.84); // Initial center longitude
  let zoomLevel = $state(1); // Initial zoom level (higher = more zoomed in)

  // Screen dimensions
  let screenWidth = $state(0);
  let screenHeight = $state(0);

  // Aircraft visibility control
  let selectedAircraft = $state<Set<string>>(new Set());
  let showAircraftPanel = $state(true);

  // Function to get aircraft display name
  function getAircraftDisplayName(aircraft: any, key: string) {
    return aircraft.address || key;
  }

  // Function to toggle aircraft visibility
  function toggleAircraftVisibility(key: string, checked: boolean) {
    const aircraft = aircrafts[key];
    if (aircraft) {
      aircraft.hidden = !checked;
      if (checked) {
        selectedAircraft.add(key);
      } else {
        selectedAircraft.delete(key);
      }
      selectedAircraft = new Set(selectedAircraft); // Trigger reactivity
    }
  }

  // Function to toggle all aircraft
  function toggleAllAircraft(checked: boolean) {
    Object.keys(aircrafts).forEach((key) => {
      const aircraft = aircrafts[key];
      if (aircraft) {
        aircraft.hidden = !checked;
        if (checked) {
          selectedAircraft.add(key);
        } else {
          selectedAircraft.delete(key);
        }
      }
    });
    selectedAircraft = new Set(selectedAircraft); // Trigger reactivity
  }

  // Function to show only selected aircraft
  function showOnlyAircraft(targetKey: string) {
    Object.keys(aircrafts).forEach((key) => {
      const aircraft = aircrafts[key];
      if (aircraft) {
        aircraft.hidden = key !== targetKey;
        if (key === targetKey) {
          selectedAircraft.add(key);
        } else {
          selectedAircraft.delete(key);
        }
      }
    });
    selectedAircraft = new Set(selectedAircraft); // Trigger reactivity
  }

  // Function to format aircraft tooltip data
  function getAircraftTooltip(aircraft: any, key: string) {
    const lines = [
      `ID: ${aircraft.address || key}`,
      `Altitude: ${aircraft.altitude || 'N/A'}m`,
      `Position: ${aircraft.latitude?.toFixed(6) || 'N/A'}, ${aircraft.longitude?.toFixed(6) || 'N/A'}`,
      `Heading: ${aircraft.heading || 'N/A'}°`,
      `Speed: ${aircraft.speed || 'N/A'} knots`,
      `Signal: ${aircraft.rssi || 'N/A'} dB`,
      `Receiver: ${aircraft.receiver || 'N/A'}`,
      `Last seen: ${aircraft.timestamp ? new Date(aircraft.timestamp).toLocaleTimeString() : 'N/A'}`
    ];
    return lines.join('\n');
  }

  // Initialize new aircraft as visible by default
  $effect(() => {
    Object.keys(aircrafts).forEach((key) => {
      const aircraft = aircrafts[key];
      if (aircraft && !aircraft.hidden && !selectedAircraft.has(key)) {
        selectedAircraft.add(key);
        selectedAircraft = new Set(selectedAircraft); // Trigger reactivity
      }
    });
  });

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
    const x = (lon - centerLon) / degreesPerPixel + screenWidth / 2;

    // Convert latitude to y (flip Y axis since screen coordinates go down)
    const y = (centerLat - lat) / degreesPerPixel + screenHeight / 2;

    return { x, y };
  }

  // Get coordinate bounds for debugging
  $effect(() => {
    const aircraftList = Object.values(aircrafts);
    if (aircraftList.length > 0) {
      const lats = aircraftList
        .map((a) => a.latitude)
        .filter((lat) => !isNaN(lat) && lat != null);
      const lons = aircraftList
        .map((a) => a.longitude)
        .filter((lon) => !isNaN(lon) && lon != null);
      if (lats.length > 0 && lons.length > 0) {
        console.log(
          "Lat range:",
          Math.min(...lats).toFixed(6),
          "to",
          Math.max(...lats).toFixed(6)
        );
        console.log(
          "Lon range:",
          Math.min(...lons).toFixed(6),
          "to",
          Math.max(...lons).toFixed(6)
        );
      }
    }
  });

  // Keyboard controls
  function handleKeydown(event: KeyboardEvent) {
    const panStep = 0.01 / Math.pow(2, zoomLevel - 5); // Adjust pan step based on zoom

    switch (event.key) {
      case "ArrowUp":
        centerLat += panStep;
        event.preventDefault();
        break;
      case "ArrowDown":
        centerLat -= panStep;
        event.preventDefault();
        break;
      case "ArrowLeft":
        centerLon -= panStep;
        event.preventDefault();
        break;
      case "ArrowRight":
        centerLon += panStep;
        event.preventDefault();
        break;
      case "+":
      case "=":
        zoomLevel = Math.min(zoomLevel + 1, 15);
        event.preventDefault();
        break;
      case "-":
        zoomLevel = Math.max(zoomLevel - 1, 1);
        event.preventDefault();
        break;
    }
  }

 
  // Helper function to create a delay promise
  function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function processEntries(maxEntries: number) {
    const entries = bigass
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    let lastTimestamp = Date.parse(entries[0]).valueOf();
    let instant = true;
    
    while (cursor < Math.min(maxEntries, entries.length)) {
      const entry = entries[cursor++];
      if (entry) {
        const signal = processIncomingAircraftSignal(entry);
        if (signal) {
          if (!instant) {
            await delay((signal.timestamp! - lastTimestamp) * FFWD_FACTOR);
          }
          lastTimestamp = signal.timestamp!;
        }
      }
    }
    // outOfData = true;
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

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  // processEntries(10_000);

  // connect to ws at ws://192.87.172.71:1338
  const ws = new WebSocket("ws://192.87.172.71:1338");

  ws.onmessage = (event) => {
    processIncomingAircraftSignal(event.data);
  };

  onDestroy(() => {
    ws.close();
  });

  let showLittlePlanes = $state(true);
  let hoveredAircraft = $state<string | null>(null);
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

    <!-- Aircraft Control Panel -->
    <div
      class="absolute top-0 left-0 h-full {showAircraftPanel
        ? 'w-80'
        : 'w-12'} bg-black bg-opacity-80 text-white z-20 flex flex-col transition-all duration-300"
    >
      <div class="p-4 {showAircraftPanel ? 'border-b border-gray-600' : ''}">
        <div class="flex items-center justify-between mb-2">
          {#if showAircraftPanel}
            <h2 class="text-lg font-bold">Aircraft Control</h2>
          {/if}
          <button
            on:click={() => (showAircraftPanel = !showAircraftPanel)}
            class="text-gray-400 hover:text-white p-1"
            title={showAircraftPanel ? "Collapse panel" : "Expand panel"}
          >
            {showAircraftPanel ? "←" : "→"}
          </button>
        </div>
        {#if showAircraftPanel}
          <div class="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="toggle-all"
              checked={Object.keys(aircrafts).length > 0 &&
                Object.keys(aircrafts).every((key) =>
                  selectedAircraft.has(key)
                )}
              on:change={(e) => toggleAllAircraft(e.currentTarget.checked)}
              class="rounded"
            />
            <label for="toggle-all" class="text-sm"
              >Toggle All ({Object.keys(aircrafts).length} aircraft)</label
            >
          </div>
        {/if}
      </div>

      {#if showAircraftPanel}
        <div class="flex-1 overflow-y-auto p-4">
          {#if Object.keys(aircrafts).length === 0}
            <div class="text-gray-400 text-sm">No aircraft detected yet...</div>
          {:else}
            <!-- {@const sortedAircraft = Object.entries(aircrafts).sort(([,a], [,b]) => (b.rssi || 0) - (a.rssi || 0))} -->
            {@const maxRssi = Math.max(
              ...Object.values(aircrafts).map((a) => a.rssi || 0)
            )}
            {@const minRssi = Math.min(
              ...Object.values(aircrafts).map((a) => a.rssi || 0)
            )}
            <div class="space-y-2">
              {#each Object.entries(aircrafts) as [key, aircraft]}
                {@const isVisible = selectedAircraft.has(key)}
                {@const rssiPercentage =
                  maxRssi > minRssi
                    ? (((aircraft.rssi || 0) - minRssi) / (maxRssi - minRssi)) *
                      100
                    : 50}
                {@const signalBars = Math.ceil(rssiPercentage / 25)}
                <div
                  class="flex items-center gap-2 p-2 bg-gray-800 bg-opacity-50 rounded text-xs"
                >
                  <input
                    type="checkbox"
                    id="aircraft-{key}"
                    checked={isVisible}
                    on:change={(e) =>
                      toggleAircraftVisibility(key, e.currentTarget.checked)}
                    class="rounded"
                  />
                  <label for="aircraft-{key}" class="flex-1 cursor-pointer">
                    <div class="flex items-center gap-2">
                      <div class="font-mono">
                        {getAircraftDisplayName(aircraft, key)}
                      </div>
                      <!-- Signal strength indicator -->
                      <div
                        class="flex items-center gap-1"
                        title="Signal: {aircraft.rssi || 0} dB"
                      >
                        {#each Array(4) as _, i}
                          <div
                            class="w-1 h-2 {i < signalBars
                              ? 'bg-green-500'
                              : 'bg-gray-600'} rounded-sm"
                          ></div>
                        {/each}
                        <span class="text-gray-500 text-xs ml-1"
                          >{aircraft.rssi || 0}</span
                        >
                      </div>
                    </div>
                    <div class="text-gray-400">
                      Alt: {aircraft.altitude || "N/A"}m |
                      {aircraft.receiver === "zi-5067" ? "Red" : "Blue"}
                    </div>
                    {#if aircraft.latitude && aircraft.longitude}
                      <div class="text-gray-500">
                        {aircraft.latitude.toFixed(3)}, {aircraft.longitude.toFixed(
                          3
                        )}
                      </div>
                    {/if}
                  </label>
                  <div
                    class="w-2 h-2 {aircraft.receiver === 'zi-5067'
                      ? 'bg-red-500'
                      : 'bg-blue-500'} rounded-full"
                  ></div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Controls info -->
    <div
      class="absolute top-0 {showAircraftPanel
        ? 'left-80'
        : 'left-12'} p-4 text-white text-xs z-20 bg-black bg-opacity-50 rounded-br-lg transition-all duration-300"
    >
      <div>Use arrow keys to pan</div>
      <div>Use +/- to zoom</div>
      <div>Center: {centerLat.toFixed(3)}, {centerLon.toFixed(3)}</div>
      <div>Zoom: {zoomLevel}</div>
      {#if Object.values(aircrafts).length > 0}
        {@const aircraftList = Object.values(aircrafts)}
        {@const lats = aircraftList
          .map((a) => a.latitude)
          .filter((lat) => !isNaN(lat) && lat != null)}
        {@const lons = aircraftList
          .map((a) => a.longitude)
          .filter((lon) => !isNaN(lon) && lon != null)}
        {#if lats.length > 0 && lons.length > 0}
          <div>
            Lat: {Math.min(...lats).toFixed(3)} to {Math.max(...lats).toFixed(
              3
            )}
          </div>
          <div>
            Lon: {Math.min(...lons).toFixed(3)} to {Math.max(...lons).toFixed(
              3
            )}
          </div>
        {:else}
          <div>No valid coordinates yet</div>
        {/if}
      {/if}
    </div>

    <!-- Stats -->
    <div class="flex gap-4 absolute top-0 right-0 p-4 flex-col z-20">
      <div class="text-white text-xs">
        Aircraft count: {Object.keys(aircrafts).length}
        In range: {Object.values(aircrafts).filter(
          (aircraft) => !aircraft.hidden
        ).length}
      </div>
      <div class="text-red-500 font-mono text-xs">
        zi-5067: {receiverBitrates.get("zi-5067")?.toFixed(2) || 0} signals/sec
      </div>
      <div class="text-blue-500 font-mono text-xs">
        zi-5110: {receiverBitrates.get("zi-5110")?.toFixed(2) || 0} signals/sec
      </div>
    </div>

    {#each Object.entries(aircrafts) as [key, aircraft]}
      {@const visibleAircraft = Object.values(aircrafts).filter(
        (a) => !a.hidden
      )}
      {@const maxRssi =
        visibleAircraft.length > 0
          ? Math.max(...visibleAircraft.map((a) => a.rssi || -100))
          : -100}
      {@const minRssi =
        visibleAircraft.length > 0
          ? Math.min(...visibleAircraft.map((a) => a.rssi || -100))
          : -100}
      {$inspect({ maxRssi, minRssi })}

      {@const rssi = aircraft.rssi - minRssi}
      {@const rssiPercentage =
        maxRssi > minRssi ? rssi / (maxRssi - minRssi) : 1.0}
      {@const screenPos = latLonToScreen(aircraft.latitude, aircraft.longitude)}

      <!-- Aircraft Position Component -->
      {#if !aircraft.hidden && screenPos.x >= -50 && screenPos.x <= screenWidth + 50 && screenPos.y >= -50 && screenPos.y <= screenHeight + 50}
        <!-- Position Trail -->
        {#if aircraft.positionHistory && aircraft.positionHistory.length > 0}
          {#each aircraft.positionHistory as historyPos, index}
            {@const trailScreenPos = latLonToScreen(
              historyPos.latitude,
              historyPos.longitude
            )}
            {@const historyRssiPercentage =
              maxRssi > minRssi
                ? (historyPos.rssi - minRssi) / (maxRssi - minRssi)
                : 0.5}
            {@const trailOpacity = Math.max(0.1, historyRssiPercentage * 0.8)}
            {@const trailSize = Math.max(1, 2 + historyRssiPercentage * 2)}
            <!-- {#if trailScreenPos.x >= -50 && trailScreenPos.x <= screenWidth + 50 && trailScreenPos.y >= -50 && trailScreenPos.y <= screenHeight + 50} -->
            <div
              class="absolute {aircraft.receiver === 'zi-5067'
                ? 'bg-red-500'
                : 'bg-blue-500'} rounded-full transition-all duration-200"
              style="left: {trailScreenPos.x}px; top: {trailScreenPos.y}px; transform: translate(-50%, -50%); opacity: {trailOpacity}; width: {trailSize}px; height: {trailSize}px;"
              title="Signal: {historyPos.rssi} dB at {new Date(
                historyPos.timestamp
              ).toLocaleTimeString()}"
            ></div>
            <!-- {/if} -->
          {/each}
        {/if}

        <!-- Current Aircraft Position -->
        <div
          class="absolute flex flex-col items-center justify-center transition-all duration-200"
          style="left: {screenPos.x}px; top: {screenPos.y}px; transform: translate(-50%, -50%); opacity: {hoveredAircraft === key ? 1 : Math.max(
            0.3,
            rssiPercentage
          )}"
        >
          <!-- <div
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
        </div> -->
          {#if showLittlePlanes}
            <div
              class="{aircraft.receiver === 'zi-5067'
                ? 'text-red-300'
                : 'text-blue-300'} relative z-20 cursor-pointer hover:scale-125 transition-transform duration-200"
              style="transform: rotateZ({aircraft.heading}deg);"
              on:click={() => showOnlyAircraft(key)}
              on:mouseenter={() => hoveredAircraft = key}
              on:mouseleave={() => hoveredAircraft = null}
              role="button"
              tabindex="0"
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  showOnlyAircraft(key);
                }
              }}
            >
              <!-- <div
              class="w-5 h-5 bg-green-200/70 absolute left-1/2 -translate-x-1/2 translate-y-0 rounded-full animate-ping"
            ></div> -->
              <div class=" text-xs -rotate-90">✈</div>
            </div>
          {/if}
          
          <!-- Custom Tooltip (outside rotated airplane) -->
          {#if hoveredAircraft === key && showLittlePlanes}
            <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
              <div class="bg-black bg-opacity-90 text-white text-xs p-3 rounded-lg shadow-lg border border-gray-600 whitespace-nowrap">
                <div class="flex flex-col gap-1">
                  <div><strong>ID:</strong> {aircraft.address || key}</div>
                  <div><strong>Altitude:</strong> {aircraft.altitude || 'N/A'}m</div>
                  <div><strong>Position:</strong> {aircraft.latitude?.toFixed(6) || 'N/A'}, {aircraft.longitude?.toFixed(6) || 'N/A'}</div>
                  <div><strong>Heading:</strong> {aircraft.heading || 'N/A'}°</div>
                  <div><strong>Speed:</strong> {aircraft.speed || 'N/A'} knots</div>
                  <div><strong>Signal:</strong> {aircraft.rssi || 'N/A'} dB</div>
                  <div><strong>Receiver:</strong> {aircraft.receiver || 'N/A'}</div>
                  <div><strong>Last seen:</strong> {aircraft.timestamp ? new Date(aircraft.timestamp).toLocaleTimeString() : 'N/A'}</div>
                </div>
                <!-- Tooltip Arrow -->
                <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black border-t-opacity-90"></div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</main>
