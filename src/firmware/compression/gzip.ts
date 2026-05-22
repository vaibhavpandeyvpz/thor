import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import type { CompressedFile } from "./types.js";

export class GzipCompressedFile implements CompressedFile {
  readonly compression = "gzip" as const;

  constructor(
    readonly path: string,
    readonly offset: number,
    readonly length: number,
  ) {}

  async inspect(): Promise<bigint> {
    if (this.length < 18) {
      throw new Error("GZIP member too short");
    }
    const handle = await open(this.path, "r");
    try {
      const magic = Buffer.alloc(2);
      await handle.read(magic, 0, magic.byteLength, this.offset);
      if (magic[0] !== 0x1f || magic[1] !== 0x8b) {
        throw new Error("Invalid GZIP magic");
      }

      const trailer = Buffer.alloc(4);
      await handle.read(
        trailer,
        0,
        trailer.byteLength,
        this.offset + this.length - 4,
      );
      return BigInt(trailer.readUInt32LE(0));
    } finally {
      await handle.close();
    }
  }

  async *decode(): AsyncIterable<Buffer> {
    const input = createReadStream(this.path, {
      start: this.offset,
      end: this.offset + this.length - 1,
    });
    yield* input.pipe(createGunzip());
  }
}
