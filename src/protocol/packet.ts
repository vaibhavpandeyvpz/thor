import { COMMAND_PACKET_SIZE, Command, InitRequest } from "./constants.js";

export interface OdinResponse {
  readonly cmd: number;
  readonly value: number;
  readonly words: readonly number[];
}

export interface TransferCompleteArgs {
  readonly binaryType: number;
  readonly sequenceByteCount: number;
  readonly unknown1?: number;
  readonly deviceType: number;
  readonly identifier: number;
  readonly endOfFile: boolean;
  readonly efsClear?: boolean;
  readonly bootUpdate?: boolean;
}

export function packCommand(
  cmd: number,
  subcmd = 0,
  words: readonly number[] = [],
): Buffer {
  if (words.length > 9) {
    throw new RangeError(
      `Odin command can carry at most 9 argument words, got ${words.length}`,
    );
  }

  const packet = Buffer.alloc(COMMAND_PACKET_SIZE);
  packet.writeUInt32LE(cmd >>> 0, 0);
  packet.writeUInt32LE(subcmd >>> 0, 4);
  for (let i = 0; i < words.length; i += 1) {
    packet.writeUInt32LE((words[i] ?? 0) >>> 0, 8 + i * 4);
  }
  return packet;
}

export function packInitTotalBytes(totalBytes: bigint | number): Buffer {
  const total = BigInt(totalBytes);
  if (total < 0n) {
    throw new RangeError("totalBytes must be non-negative");
  }
  const lo = Number(total & 0xffffffffn);
  const hi = Number((total >> 32n) & 0xffffffffn);
  return packCommand(Command.Init, InitRequest.TotalBytes, [lo, hi]);
}

export function packTransferComplete(args: TransferCompleteArgs): Buffer {
  return packCommand(Command.Transfer, 3, [
    args.binaryType,
    args.sequenceByteCount,
    args.unknown1 ?? 0,
    args.deviceType,
    args.identifier,
    args.endOfFile ? 1 : 0,
    args.efsClear ? 1 : 0,
    args.bootUpdate ? 1 : 0,
  ]);
}

export function unpackResponse(data: Buffer | Uint8Array): OdinResponse {
  if (data.byteLength < 8) {
    throw new Error(`Odin response too short: ${data.byteLength} bytes`);
  }
  const view = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const words: number[] = [];
  for (
    let offset = 8;
    offset + 4 <= Math.min(view.byteLength, 44);
    offset += 4
  ) {
    words.push(view.readUInt32LE(offset));
  }
  return {
    cmd: view.readUInt32LE(0),
    value: view.readUInt32LE(4),
    words,
  };
}

export function parseInitVariant(value: number): number {
  return (value >>> 16) & 0xffff;
}

export function roundUp(value: number | bigint, quantum: number): number {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new RangeError(`Cannot round unsafe size ${value.toString()}`);
  }
  return Math.ceil(numeric / quantum) * quantum;
}

export function assertAck(
  response: OdinResponse,
  cmd: number,
  context: string,
): void {
  if (response.cmd !== cmd || response.value !== 0) {
    throw new Error(
      `${context} rejected: cmd=${response.cmd} value=${response.value}`,
    );
  }
}
