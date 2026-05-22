import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { createCompressedFile } from "../src/firmware/compression/index.js";
import { planFirmware } from "../src/firmware/firmware.js";

test("planFirmware uses decompressed GZIP trailer size for Odin transport bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-gz-"));
  try {
    const path = join(dir, "modem.bin.gz");
    const compressed = gzipSync(Buffer.from("hello", "ascii"));
    await writeFile(path, compressed);
    const firmware = await planFirmware(path);
    assert.equal(firmware.items()[0]?.compression, "gzip");
    assert.equal(firmware.items()[0]?.size.compressed, compressed.byteLength);
    assert.equal(firmware.items()[0]?.size.actual, 5n);
    assert.equal(firmware.totalTransportBytes, 5n);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CompressedFile decode streams GZIP bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-gz-"));
  try {
    const path = join(dir, "modem.bin.gz");
    const compressed = gzipSync(Buffer.from("hello", "ascii"));
    await writeFile(path, compressed);
    const file = createCompressedFile(path, 0, compressed.byteLength, "gzip");
    const chunks: Buffer[] = [];
    for await (const chunk of file.decode()) {
      chunks.push(chunk);
    }
    assert.equal(Buffer.concat(chunks).toString("ascii"), "hello");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
