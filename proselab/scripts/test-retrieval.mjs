/**
 * test-retrieval.mjs
 * 
 * Stateless integration test script for verifying contract compliance of the retrievalService.
 * Validates the adapter injection, initialization state, unified return structure,
 * and error/warning propagation without requiring a browser or database runtime.
 */

import { retrievalService } from "../src/services/retrievalService.js";

async function runTests() {
  console.log("🧪 STARTING STATELESS RETRIEVAL SERVICE VERIFICATION...\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Test 1: Service is not initialized initially
  assert(
    retrievalService.isInitialized() === false,
    "Service starts uninitialized."
  );

  // Test 2: getPassages returns clean error payload if called before initialization
  const earlyResult = await retrievalService.getPassages("proj-1", "test");
  assert(
    earlyResult.success === false &&
    earlyResult.data === null &&
    earlyResult.error.includes("not initialized"),
    "getPassages returns soft error payload prior to initialization."
  );

  // Test 3: Initialize with a valid mock adapter
  const mockAdapter = {
    async getPassages(projectId, query, options) {
      if (query === "Karachi") {
        return {
          success: true,
          passages: [
            {
              id: "scene-12",
              text: "The Karachi dental records proved Marcus was alive.",
              metadata: { title: "Dental Match", updatedAt: Date.now() }
            }
          ],
          warnings: ["Lore database is currently uncalibrated."],
          error: null
        };
      }
      if (query === "trigger-error") {
        throw new Error("Simulated database failure");
      }
      return {
        success: true,
        passages: [],
        warnings: [],
        error: null
      };
    }
  };

  try {
    retrievalService.init(mockAdapter);
    assert(
      retrievalService.isInitialized() === true,
      "Successfully registers and initializes with valid mock adapter."
    );
  } catch (err) {
    assert(false, `Initialization failed: ${err.message}`);
  }

  // Test 4: Verify initialization guard throws on second init
  try {
    retrievalService.init(mockAdapter);
    assert(false, "init() failed to block duplicate registration.");
  } catch (err) {
    assert(
      err.message.includes("Already initialized"),
      "init() throws correctly when registering multiple times."
    );
  }

  // Test 5: Verify successful query results contract
  console.log("\n--- Testing unified return shape contract ---");
  const result = await retrievalService.getPassages("proj-1", "Karachi");
  
  assert(
    result.success === true,
    "Result success status is true."
  );
  assert(
    result.error === null,
    "Result error field is null."
  );
  assert(
    Array.isArray(result.warnings) && result.warnings.length === 1 && result.warnings[0].includes("uncalibrated"),
    "Warnings array is propagated successfully from the adapter."
  );
  assert(
    result.data !== null && Array.isArray(result.data.passages) && result.data.passages.length === 1,
    "Passages array is loaded into data.passages."
  );
  assert(
    result.data.passages[0].id === "scene-12" && result.data.passages[0].text.includes("Karachi"),
    "Passage fields (id, text, metadata) are mapped perfectly."
  );
  assert(
    result.data.metrics && typeof result.data.metrics.duration_ms === "number",
    "Performance metrics are captured inside data.metrics."
  );

  // Test 6: Verify adapter error propagation
  const errorResult = await retrievalService.getPassages("proj-1", "trigger-error");
  assert(
    errorResult.success === false &&
    errorResult.data === null &&
    errorResult.error.includes("Simulated database failure"),
    "getPassages gracefully captures adapter exceptions and returns them inside the error field."
  );

  console.log(`\n📊 VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL CONTRACT TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

runTests();
