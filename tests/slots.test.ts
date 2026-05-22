import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { planFirmwareSlots } from "../src/firmware/firmware.js";

test("planFirmwareSlots flattens packages in Odin flash order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-slots-"));
  try {
    const bl = join(dir, "bl.bin");
    const ap = join(dir, "ap.bin");
    const csc = join(dir, "csc.bin");
    const userdata = join(dir, "userdata.bin");
    await writeFile(bl, "b");
    await writeFile(ap, "a");
    await writeFile(csc, "c");
    await writeFile(userdata, "u");

    const plan = await planFirmwareSlots({
      USERDATA: userdata,
      CSC: csc,
      AP: ap,
      BL: bl,
    });

    assert.deepEqual(
      plan.items().map((pkg) => pkg.slot),
      ["BL", "AP", "CSC", "USERDATA"],
    );
    assert.deepEqual(
      plan.firmwareItems().map((item) => item.path),
      [bl, ap, csc, userdata],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
