import { open, stat } from "node:fs/promises";
import { fileRange } from "../../utils/md5.js";
import { Tar } from "./tar.js";
import type { TarMd5Info } from "./types.js";

export class TarMd5 extends Tar {
  async load(): Promise<void> {
    const md5 = await this.validate();
    this.setEntries(await this.readEntries(md5.tarSize));
  }

  private async validate(): Promise<TarMd5Info> {
    const file = await stat(this.path);
    if (file.size <= 0 || file.size > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Unsupported file size for MD5 validation: ${file.size}`);
    }

    const tailSize = Math.min(Number(file.size), 64 * 1024);
    const tail = Buffer.alloc(tailSize);
    const handle = await open(this.path, "r");
    try {
      await handle.read(
        tail,
        0,
        tail.byteLength,
        Number(file.size) - tail.byteLength,
      );
    } finally {
      await handle.close();
    }

    const trailer = tail.toString("ascii");
    const expected = parseExpectedMd5(trailer);
    const checksumSize = Number(file.size) - tail.byteLength + expected.offset;
    const tarSize = parseOriginalTarSize(trailer) ?? checksumSize;
    if (tarSize <= 0 || tarSize > file.size) {
      throw new Error(`Invalid original TAR size in MD5 trailer: ${tarSize}`);
    }
    if (checksumSize <= 0 || checksumSize > file.size) {
      throw new Error(`Invalid MD5 checksum boundary: ${checksumSize}`);
    }

    const actual = await fileRange(this.path, checksumSize);
    const info: TarMd5Info = {
      expected: expected.digest,
      actual,
      checksumSize,
      tarSize,
    };
    if (info.actual !== info.expected) {
      throw new Error(
        `MD5 mismatch for ${this.path}: expected ${info.expected}, got ${info.actual}`,
      );
    }
    return info;
  }
}

function parseExpectedMd5(trailer: string): { digest: string; offset: number } {
  const matches = [
    ...trailer.matchAll(/(?:^|\n)([a-fA-F0-9]{32})(?:\s+\S+)?\s*$/gm),
  ];
  const last = matches.at(-1);
  const digest = last?.[1];
  if (!last || !digest || last.index === undefined) {
    throw new Error("No final MD5 line found in .tar.md5 trailer");
  }
  const offset = trailer[last.index] === "\n" ? last.index + 1 : last.index;
  return { digest: digest.toLowerCase(), offset };
}

function parseOriginalTarSize(trailer: string): number | undefined {
  const match = trailer.match(/original_tar_file_size\s*:\s*(\d+)/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
}
