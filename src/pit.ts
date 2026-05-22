export const PIT_MAGIC = 0x12349876;
export const PIT_HEADER_SIZE = 28;
export const PIT_ENTRY_SIZE = 132;

export interface PitEntry {
  readonly binaryType: number;
  readonly deviceType: number;
  readonly identifier: number;
  readonly attributes: number;
  readonly updateAttributes: number;
  readonly blockSizeOrOffset: number;
  readonly blockCount: number;
  readonly fileOffset: number;
  readonly fileSize: number;
  readonly partitionName: string;
  readonly flashFilename: string;
  readonly fotaFilename: string;
}

export class Pit {
  readonly entries: readonly PitEntry[];

  constructor(entries: readonly PitEntry[]) {
    this.entries = entries;
  }

  byFlashFilename(): Map<string, PitEntry> {
    const map = new Map<string, PitEntry>();
    for (const entry of this.entries) {
      if (entry.flashFilename.length > 0) {
        map.set(entry.flashFilename.toLowerCase(), entry);
      }
    }
    return map;
  }

  findByFlashFilename(filename: string): PitEntry | undefined {
    const normalized = stripCompressionSuffix(baseName(filename)).toLowerCase();
    return (
      this.byFlashFilename().get(normalized) ??
      this.byFlashFilename().get(baseName(filename).toLowerCase())
    );
  }
}

export function parsePit(data: Buffer | Uint8Array): Pit {
  const buf = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buf.byteLength < PIT_HEADER_SIZE) {
    throw new Error("PIT data too short");
  }

  const magic = buf.readUInt32LE(0);
  const entryCount = buf.readUInt32LE(4);

  if (magic !== PIT_MAGIC) {
    throw new Error(`Bad PIT magic: 0x${magic.toString(16).padStart(8, "0")}`);
  }

  const needed = PIT_HEADER_SIZE + entryCount * PIT_ENTRY_SIZE;
  if (buf.byteLength < needed) {
    throw new Error(`PIT truncated: need ${needed}, got ${buf.byteLength}`);
  }

  const entries: PitEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    const offset = PIT_HEADER_SIZE + i * PIT_ENTRY_SIZE;
    entries.push({
      binaryType: buf.readUInt32LE(offset),
      deviceType: buf.readUInt32LE(offset + 4),
      identifier: buf.readUInt32LE(offset + 8),
      attributes: buf.readUInt32LE(offset + 12),
      updateAttributes: buf.readUInt32LE(offset + 16),
      blockSizeOrOffset: buf.readUInt32LE(offset + 20),
      blockCount: buf.readUInt32LE(offset + 24),
      fileOffset: buf.readUInt32LE(offset + 28),
      fileSize: buf.readUInt32LE(offset + 32),
      partitionName: cString(buf.subarray(offset + 36, offset + 68)),
      flashFilename: cString(buf.subarray(offset + 68, offset + 100)),
      fotaFilename: cString(buf.subarray(offset + 100, offset + 132)),
    });
  }

  return new Pit(entries);
}

function cString(raw: Buffer): string {
  const nul = raw.indexOf(0);
  return raw.subarray(0, nul === -1 ? raw.byteLength : nul).toString("ascii");
}

function baseName(path: string): string {
  return path.replaceAll("\\", "/").split("/").pop() ?? path;
}

function stripCompressionSuffix(filename: string): string {
  return filename.replace(/\.(lz4|gz)$/i, "");
}
