import assert from "node:assert/strict";
import { closeSharedState, deleteSharedKey, readSharedJson, writeSharedJson } from "./realtime";

async function run() {
  await closeSharedState();

  assert.equal(await writeSharedJson("realtime-check", { live: true, viewers: 7 }, 5), true);
  assert.deepEqual(await readSharedJson<{ live: boolean; viewers: number }>("realtime-check"), { live: true, viewers: 7 });

  assert.equal(await deleteSharedKey("realtime-check"), true);
  assert.equal(await readSharedJson("realtime-check"), null);

  for (let index = 0; index < 300; index += 1) {
    await writeSharedJson(`realtime-check:${index}`, { index }, 5);
  }
  assert.equal(await readSharedJson("realtime-check:0"), null, "the local fallback retains a bounded LRU cache");
  assert.deepEqual(await readSharedJson<{ index: number }>("realtime-check:299"), { index: 299 });

  await closeSharedState();
  console.log("Kryv local shared-cache fallback checks passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
