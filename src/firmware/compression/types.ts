export type Compression = "none" | "lz4" | "gzip";

export interface CompressedFile {
  readonly path: string;
  readonly offset: number;
  readonly length: number;
  readonly compression: Compression;
  inspect(): Promise<bigint>;
  decode(): AsyncIterable<Buffer>;
}
