import { createReadStream } from "node:fs";
import type { CompressedFile } from "./types.js";

export class UncompressedFile implements CompressedFile {
  readonly compression = "none" as const;

  constructor(
    readonly path: string,
    readonly offset: number,
    readonly length: number,
  ) {}

  async inspect(): Promise<bigint> {
    return BigInt(this.length);
  }

  async *decode(): AsyncIterable<Buffer> {
    const input = createReadStream(this.path, {
      start: this.offset,
      end: this.offset + this.length - 1,
    });
    yield* input;
  }
}
