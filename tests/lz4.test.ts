import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCompressedFile } from "../src/firmware/compression/index.js";
import { planFirmware } from "../src/firmware/firmware.js";

test("CompressedFile inspect reads content size from LZ4 frame", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-lz4-"));
  try {
    const path = join(dir, "boot.img.lz4");
    await writeFile(path, rawBlockFrame("hello"));
    const file = createCompressedFile(path, 0, 28, "lz4");
    assert.equal(await file.inspect(), 5n);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("planFirmware uses decompressed LZ4 content size for Odin transport bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-lz4-"));
  try {
    const path = join(dir, "boot.img.lz4");
    await writeFile(path, rawBlockFrame("hello"));
    const firmware = await planFirmware(path);
    assert.equal(firmware.items()[0]?.compression, "lz4");
    assert.equal(firmware.items()[0]?.size.compressed, 28);
    assert.equal(firmware.items()[0]?.size.actual, 5n);
    assert.equal(firmware.totalTransportBytes, 5n);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CompressedFile decode uses lz4 package stream decoder", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-lz4-"));
  try {
    const path = join(dir, "boot.img.lz4");
    await writeFile(path, rawBlockFrame("hello"));
    const file = createCompressedFile(path, 0, 28, "lz4");
    const chunks: Buffer[] = [];
    for await (const chunk of file.decode()) {
      chunks.push(chunk);
    }
    assert.equal(Buffer.concat(chunks).toString("ascii"), "hello");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function blockHeader(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value >>> 0, 0);
  return out;
}

function rawBlockFrame(text: string): Buffer {
  const payload = Buffer.from(text, "ascii");
  const contentSize = Buffer.alloc(8);
  contentSize.writeBigUInt64LE(BigInt(payload.byteLength), 0);
  return Buffer.concat([
    Buffer.from("04224d186840", "hex"),
    contentSize,
    Buffer.from("61", "hex"),
    blockHeader(0x80000000 | payload.byteLength),
    payload,
    Buffer.alloc(4),
  ]);
}
