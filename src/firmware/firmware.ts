import { stat } from "node:fs/promises";
import { createTar, isTarArchive } from "./archive/index.js";
import { createCompressedFile, type Compression } from "./compression/index.js";

export type FirmwareSlot = "BL" | "AP" | "CP" | "CSC" | "USERDATA";

export const FLASH_SLOT_ORDER: readonly FirmwareSlot[] = [
  "BL",
  "AP",
  "CP",
  "CSC",
  "USERDATA",
] as const;

export interface FirmwareItem {
  readonly path: string;
  readonly name: string;
  readonly size: {
    readonly compressed: number;
    readonly actual: bigint;
  };
  readonly offset: number;
  readonly compression: Compression;
}

export type FirmwareSlotInputs = Partial<Record<FirmwareSlot, string>>;

export class Firmware {
  readonly path: string;
  readonly slot: FirmwareSlot | undefined;
  private readonly members: readonly FirmwareItem[];

  private constructor(
    path: string,
    members: readonly FirmwareItem[],
    slot?: FirmwareSlot,
  ) {
    this.path = path;
    this.members = members;
    this.slot = slot;
  }

  static async fromPath(path: string, slot?: FirmwareSlot): Promise<Firmware> {
    if (isTarArchive(path)) {
      const archive = createTar(path);
      await archive.load();
      const members = await Promise.all(
        archive
          .entries()
          .filter((member) => shouldFlashMember(member.name))
          .map((member) =>
            itemFromName(path, member.name, member.size, member.dataOffset),
          ),
      );
      return new Firmware(path, members, slot);
    }

    const info = await stat(path);
    const item = await itemFromName(path, path, Number(info.size), 0);
    return new Firmware(path, [item], slot);
  }

  items(): readonly FirmwareItem[] {
    return this.members;
  }

  get totalTransportBytes(): bigint {
    return this.members.reduce((sum, item) => sum + item.size.actual, 0n);
  }

  get hasCompressedItems(): boolean {
    return this.members.some((item) => item.compression !== "none");
  }

  toJSON() {
    const out: {
      path: string;
      slot?: FirmwareSlot;
      items: readonly FirmwareItem[];
      totalTransportBytes: bigint;
      hasCompressedItems: boolean;
    } = {
      path: this.path,
      items: this.items(),
      totalTransportBytes: this.totalTransportBytes,
      hasCompressedItems: this.hasCompressedItems,
    };
    if (this.slot) out.slot = this.slot;
    return out;
  }
}

export class FirmwarePlan {
  private readonly packages: readonly Firmware[];

  private constructor(packages: readonly Firmware[]) {
    this.packages = packages;
  }

  static async fromPaths(paths: readonly string[]): Promise<FirmwarePlan> {
    if (paths.length === 0) {
      throw new Error("At least one firmware package is required");
    }
    const packages = await Promise.all(
      paths.map((path) => Firmware.fromPath(path)),
    );
    return new FirmwarePlan(packages);
  }

  static async fromSlots(slots: FirmwareSlotInputs): Promise<FirmwarePlan> {
    const packages: Firmware[] = [];
    for (const slot of FLASH_SLOT_ORDER) {
      const path = slots[slot];
      if (path) {
        packages.push(await Firmware.fromPath(path, slot));
      }
    }
    if (packages.length === 0) {
      throw new Error("At least one firmware slot package is required");
    }
    return new FirmwarePlan(packages);
  }

  items(): readonly Firmware[] {
    return this.packages;
  }

  firmwareItems(): readonly FirmwareItem[] {
    return this.packages.flatMap((pkg) => [...pkg.items()]);
  }

  get totalTransportBytes(): bigint {
    return this.packages.reduce(
      (sum, pkg) => sum + pkg.totalTransportBytes,
      0n,
    );
  }

  get hasCompressedItems(): boolean {
    return this.packages.some((pkg) => pkg.hasCompressedItems);
  }

  toJSON() {
    return {
      packages: this.items(),
      items: this.firmwareItems(),
      totalTransportBytes: this.totalTransportBytes,
      hasCompressedItems: this.hasCompressedItems,
    };
  }
}

export async function planFirmwarePackages(
  paths: readonly string[],
): Promise<FirmwarePlan> {
  return FirmwarePlan.fromPaths(paths);
}

export async function planFirmwareSlots(
  slots: FirmwareSlotInputs,
): Promise<FirmwarePlan> {
  return FirmwarePlan.fromSlots(slots);
}

export async function planFirmware(
  path: string,
  slot?: FirmwareSlot,
): Promise<Firmware> {
  return Firmware.fromPath(path, slot);
}

async function itemFromName(
  path: string,
  name: string,
  compressedSize: number,
  offset: number,
): Promise<FirmwareItem> {
  const compression = detectCompression(name);
  const actualSize = await resolveTransportSize(
    path,
    offset,
    compressedSize,
    compression,
  );
  return {
    path,
    name,
    size: {
      compressed: compressedSize,
      actual: actualSize,
    },
    offset,
    compression,
  };
}

async function resolveTransportSize(
  path: string,
  offset: number,
  size: number,
  compression: Compression,
): Promise<bigint> {
  const file = createCompressedFile(path, offset, size, compression);
  return file.inspect();
}

function detectCompression(name: string): Compression {
  if (/\.lz4$/i.test(name)) return "lz4";
  if (/\.gz$/i.test(name)) return "gzip";
  return "none";
}

function shouldFlashMember(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    !lower.includes("meta-data/") &&
    !lower.endsWith(".zip") &&
    !lower.endsWith(".txt")
  );
}
