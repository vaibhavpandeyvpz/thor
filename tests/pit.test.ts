import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePit,
  PIT_ENTRY_SIZE,
  PIT_HEADER_SIZE,
  PIT_MAGIC,
} from "../src/pit.js";

test("parsePit decodes Samsung PIT header and entry strings", () => {
  const buf = Buffer.alloc(PIT_HEADER_SIZE + PIT_ENTRY_SIZE);
  buf.writeUInt32LE(PIT_MAGIC, 0);
  buf.writeUInt32LE(1, 4);
  buf.write("COM_TAR2LSI7870", 8, "ascii");
  const off = PIT_HEADER_SIZE;
  buf.writeUInt32LE(0, off);
  buf.writeUInt32LE(2, off + 4);
  buf.writeUInt32LE(11, off + 8);
  buf.write("BOOT", off + 36, "ascii");
  buf.write("boot.img", off + 68, "ascii");

  const pit = parsePit(buf);
  assert.equal(pit.entries.length, 1);
  assert.equal(pit.entries[0]?.deviceType, 2);
  assert.equal(pit.entries[0]?.identifier, 11);
  assert.equal(pit.findByFlashFilename("boot.img")?.partitionName, "BOOT");
  assert.equal(pit.findByFlashFilename("boot.img.lz4")?.identifier, 11);
});
