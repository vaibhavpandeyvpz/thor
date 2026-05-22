import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTar } from "../src/firmware/archive/index.js";
import { planFirmware } from "../src/firmware/firmware.js";

test("TarMd5 load validates Samsung trailer over original TAR byte range", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-md5-"));
  try {
    const path = join(dir, "boot.img.tar.md5");
    const tar = singleFileTar("boot.img", Buffer.from("hello", "ascii"));
    const buildInfo = Buffer.from(
      `Show the build information\noriginal_tar_file_size:${tar.byteLength}\n`,
      "ascii",
    );
    const digest = createHash("md5")
      .update(Buffer.concat([tar, buildInfo]))
      .digest("hex");
    const trailer = Buffer.concat([
      buildInfo,
      Buffer.from(`${digest}  boot.img.tar\n`, "ascii"),
    ]);
    await writeFile(path, Buffer.concat([tar, trailer]));

    const archive = createTar(path);
    await archive.load();
    assert.equal(archive.entries()[0]?.name, "boot.img");
    assert.equal(archive.entries()[0]?.size, 5);

    const firmware = await planFirmware(path);
    assert.equal(firmware.items()[0]?.name, "boot.img");
    assert.equal(firmware.items()[0]?.size.compressed, 5);
    assert.equal(firmware.items()[0]?.size.actual, 5n);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("TarMd5 load rejects modified payload", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thor-md5-"));
  try {
    const path = join(dir, "boot.img.tar.md5");
    const tar = singleFileTar("boot.img", Buffer.from("hello", "ascii"));
    const buildInfo = Buffer.from(
      `original_tar_file_size:${tar.byteLength}\n`,
      "ascii",
    );
    const digest = createHash("md5")
      .update(Buffer.concat([tar, buildInfo]))
      .digest("hex");
    tar[512] = 0x48;
    const trailer = Buffer.concat([
      buildInfo,
      Buffer.from(`${digest}  boot.img.tar\n`, "ascii"),
    ]);
    await writeFile(path, Buffer.concat([tar, trailer]));
    const archive = createTar(path);
    await assert.rejects(() => archive.load(), /MD5 mismatch/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function singleFileTar(name: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "ascii");
  header.write("0000644\0", 100, "ascii");
  header.write("0000000\0", 108, "ascii");
  header.write("0000000\0", 116, "ascii");
  header.write(
    payload.byteLength.toString(8).padStart(11, "0") + "\0",
    124,
    "ascii",
  );
  header.write("00000000000\0", 136, "ascii");
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");

  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");

  const padding = Buffer.alloc(
    Math.ceil(payload.byteLength / 512) * 512 - payload.byteLength,
  );
  return Buffer.concat([header, payload, padding, Buffer.alloc(1024)]);
}
