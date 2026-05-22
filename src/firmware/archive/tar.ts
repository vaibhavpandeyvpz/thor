import { open, type FileHandle } from "node:fs/promises";
import type { TarFileEntry } from "./types.js";

export class Tar {
  protected loadedEntries: readonly TarFileEntry[] = [];
  protected isLoaded = false;

  constructor(protected readonly path: string) {}

  async load(): Promise<void> {
    this.setEntries(await this.readEntries());
  }

  entries(): readonly TarFileEntry[] {
    if (!this.isLoaded) {
      throw new Error("Archive not loaded. Call load() before entries().");
    }
    return this.loadedEntries;
  }

  protected async readEntries(size?: number): Promise<readonly TarFileEntry[]> {
    const handle = await open(this.path, "r");
    try {
      return await this.readEntriesFromHandle(handle, size);
    } finally {
      await handle.close();
    }
  }

  protected setEntries(entries: readonly TarFileEntry[]): void {
    this.loadedEntries = entries;
    this.isLoaded = true;
  }

  private async readEntriesFromHandle(
    handle: FileHandle,
    tarSize = Number.POSITIVE_INFINITY,
  ): Promise<readonly TarFileEntry[]> {
    const entries: TarFileEntry[] = [];
    const header = Buffer.alloc(512);
    let offset = 0;

    for (;;) {
      if (offset >= tarSize) break;
      if (offset + 512 > tarSize) {
        throw new Error("Truncated TAR header before MD5 trailer boundary");
      }
      const { bytesRead } = await handle.read(
        header,
        0,
        header.byteLength,
        offset,
      );
      if (bytesRead === 0 || isZeroBlock(header)) break;
      if (bytesRead !== 512) {
        throw new Error("Truncated TAR header");
      }

      const name = tarString(header.subarray(0, 100));
      const prefix = tarString(header.subarray(345, 500));
      const size = parseOctal(header.subarray(124, 136));
      const typeflag = header[156];
      const fullName = prefix ? `${prefix}/${name}` : name;

      if (typeflag === undefined || typeflag === 0 || typeflag === 0x30) {
        entries.push({ name: fullName, size, dataOffset: offset + 512 });
      }

      offset += 512 + roundTar(size);
      if (offset > tarSize) {
        throw new Error(
          `TAR member ${fullName} extends past MD5 trailer boundary`,
        );
      }
    }

    return entries;
  }
}

export function roundTar(size: number): number {
  return Math.ceil(size / 512) * 512;
}

function tarString(raw: Buffer): string {
  const nul = raw.indexOf(0);
  return raw
    .subarray(0, nul === -1 ? raw.byteLength : nul)
    .toString("utf8")
    .trim();
}

function parseOctal(raw: Buffer): number {
  const text = tarString(raw).replace(/\0/g, "").trim();
  return text.length === 0 ? 0 : Number.parseInt(text, 8);
}

function isZeroBlock(block: Buffer): boolean {
  for (const byte of block) {
    if (byte !== 0) return false;
  }
  return true;
}
