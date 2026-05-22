import { GzipCompressedFile } from "./gzip.js";
import { Lz4CompressedFile } from "./lz4.js";
import type { CompressedFile, Compression } from "./types.js";
import { UncompressedFile } from "./none.js";

export function createCompressedFile(
  path: string,
  offset: number,
  length: number,
  compression: Compression,
): CompressedFile {
  if (compression === "gzip") {
    return new GzipCompressedFile(path, offset, length);
  }
  if (compression === "lz4") {
    return new Lz4CompressedFile(path, offset, length);
  }
  return new UncompressedFile(path, offset, length);
}
