import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { createRequire } from "node:module";
import type { CompressedFile } from "./types.js";

const require = createRequire(import.meta.url);
const lz4 = require("lz4") as typeof import("lz4");

const LZ4_FRAME_MAGIC = 0x184d2204;
const BLOCK_SIZE_TABLE = [
  0,
  0,
  0,
  0,
  64 * 1024,
  256 * 1024,
  1024 * 1024,
  4 * 1024 * 1024,
] as const;

export interface Lz4FrameInfo {
  readonly size: {
    readonly header: number;
    readonly content?: bigint;
  };
  readonly checksum: {
    readonly block: boolean;
    readonly content: boolean;
  };
  readonly max: number;
}

export class Lz4CompressedFile implements CompressedFile {
  readonly compression = "lz4" as const;

  constructor(
    readonly path: string,
    readonly offset: number,
    readonly length: number,
  ) {}

  async inspect(): Promise<bigint> {
    const info = await inspectFrame(this.path, this.offset);
    if (info.size.content === undefined) {
      throw new Error(
        "LZ4 frame has no content-size field; refusing to guess Odin transport byte count",
      );
    }
    return info.size.content;
  }

  async *decode(): AsyncIterable<Buffer> {
    const input = createReadStream(this.path, {
      start: this.offset,
      end: this.offset + this.length - 1,
    });
    yield* input.pipe(lz4.createDecoderStream({ useJS: false }));
  }
}

async function inspectFrame(path: string, offset = 0): Promise<Lz4FrameInfo> {
  const handle = await open(path, "r");
  try {
    const head = Buffer.alloc(32);
    const { bytesRead } = await handle.read(head, 0, head.byteLength, offset);
    return parseFrameHeader(head.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

function parseFrameHeader(header: Buffer): Lz4FrameInfo {
  if (header.byteLength < 7) {
    throw new Error("LZ4 frame header too short");
  }
  const magic = header.readUInt32LE(0);
  if (magic !== LZ4_FRAME_MAGIC) {
    throw new Error(
      `Invalid LZ4 frame magic: 0x${magic.toString(16).padStart(8, "0")}`,
    );
  }

  const flg = header[4] ?? 0;
  const bd = header[5] ?? 0;
  const version = (flg >> 6) & 0x03;
  if (version !== 0x01) {
    throw new Error(`Unsupported LZ4 frame version: ${version}`);
  }

  const blockIndependence = ((flg >> 5) & 0x01) === 1;
  if (!blockIndependence) {
    throw new Error(
      "Dependent LZ4 blocks are not supported for Odin streaming yet",
    );
  }

  const blockChecksum = ((flg >> 4) & 0x01) === 1;
  const hasContentSize = ((flg >> 3) & 0x01) === 1;
  const contentChecksum = ((flg >> 2) & 0x01) === 1;
  const hasDictId = (flg & 0x01) === 1;
  const blockMaxCode = (bd >> 4) & 0x07;
  const maxBlockSize = BLOCK_SIZE_TABLE[blockMaxCode] ?? 0;
  if (maxBlockSize === 0) {
    throw new Error(`Invalid LZ4 max block size code: ${blockMaxCode}`);
  }

  let cursor = 6;
  let contentSize: bigint | undefined;
  if (hasContentSize) {
    if (header.byteLength < cursor + 8) {
      throw new Error("Truncated LZ4 content-size field");
    }
    contentSize = header.readBigUInt64LE(cursor);
    cursor += 8;
  }
  if (hasDictId) {
    cursor += 4;
  }
  cursor += 1;
  if (header.byteLength < cursor) {
    throw new Error("Truncated LZ4 frame descriptor");
  }

  return {
    size: {
      header: cursor,
      ...(contentSize !== undefined ? { content: contentSize } : {}),
    },
    checksum: {
      block: blockChecksum,
      content: contentChecksum,
    },
    max: maxBlockSize,
  };
}
