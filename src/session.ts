import { createReadStream } from "node:fs";
import {
  Command,
  CloseRequest,
  DEFAULT_FILE_PART_SIZE,
  DEFAULT_TRANSFER_SEQUENCE_SIZE,
  HANDSHAKE_IN,
  HANDSHAKE_OUT,
  InitRequest,
  PitRequest,
  PIT_CHUNK_SIZE,
  TRANSFER_ROUNDING,
  TransferRequest,
} from "./protocol/constants.js";
import {
  assertAck,
  packCommand,
  packInitTotalBytes,
  parseInitVariant,
  roundUp,
  unpackResponse,
  type OdinResponse,
} from "./protocol/packet.js";
import { parsePit, type Pit, type PitEntry } from "./pit.js";
import type { OdinTransport } from "./transports/types.js";

export interface OdinSessionOptions {
  readonly filePartSize?: number;
  readonly maxTransferSequenceSize?: number;
  readonly requestedVariant?: number;
  readonly timeoutMs?: number;
  readonly firmwareResetTime?: boolean;
  readonly eraseNand?: boolean;
}

export interface ProgressEvent {
  readonly phase: "handshake" | "pit" | "transfer" | "close";
  readonly message: string;
  readonly bytesWritten?: number;
  readonly totalBytes?: number;
}

export class OdinSession {
  readonly transport: OdinTransport;
  readonly filePartSize: number;
  readonly maxTransferSequenceSize: number;
  readonly requestedVariant: number;
  readonly timeoutMs: number;
  readonly firmwareResetTime: boolean;
  readonly eraseNand: boolean;
  onProgress?: (event: ProgressEvent) => void;

  constructor(transport: OdinTransport, options: OdinSessionOptions = {}) {
    this.transport = transport;
    this.filePartSize = options.filePartSize ?? DEFAULT_FILE_PART_SIZE;
    this.maxTransferSequenceSize =
      options.maxTransferSequenceSize ?? DEFAULT_TRANSFER_SEQUENCE_SIZE;
    this.requestedVariant = options.requestedVariant ?? 5;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.firmwareResetTime = options.firmwareResetTime ?? true;
    this.eraseNand = options.eraseNand ?? false;
  }

  async handshake(): Promise<void> {
    this.progress(
      "handshake",
      `Sending ODIN handshake to ${this.transport.description}`,
    );
    await this.transport.writeExact(HANDSHAKE_OUT);
    const got = await this.transport.readExact(
      HANDSHAKE_IN.byteLength,
      this.timeoutMs,
    );
    if (!got.equals(HANDSHAKE_IN)) {
      throw new Error(
        `Unexpected handshake response: ${got.toString("hex")} (${got.toString("ascii")})`,
      );
    }
  }

  async command(
    cmd: number,
    subcmd = 0,
    words: readonly number[] = [],
    readSize = 8,
  ): Promise<OdinResponse> {
    await this.transport.writeExact(packCommand(cmd, subcmd, words));
    return unpackResponse(
      await this.transport.readExact(readSize, this.timeoutMs),
    );
  }

  async initialize(totalBytes: bigint | number): Promise<number> {
    const begin = await this.command(Command.Init, InitRequest.Begin, [
      this.requestedVariant,
    ]);
    if (begin.cmd !== Command.Init) {
      throw new Error(`Unexpected init response command: ${begin.cmd}`);
    }
    const variant = parseInitVariant(begin.value);
    if (this.firmwareResetTime) {
      assertAck(
        await this.command(Command.Init, InitRequest.ResetTime),
        Command.Init,
        "firmware reset time",
      );
    }
    if (this.eraseNand) {
      assertAck(
        await this.command(Command.Init, InitRequest.EraseUserData),
        Command.Init,
        "nand erase",
      );
    }
    assertAck(
      await this.command(Command.Init, InitRequest.FilePartSize, [
        this.filePartSize,
      ]),
      Command.Init,
      "file part size",
    );
    await this.transport.writeExact(packInitTotalBytes(totalBytes));
    assertAck(
      unpackResponse(await this.transport.readExact(8, this.timeoutMs)),
      Command.Init,
      "total byte count",
    );
    return variant;
  }

  async readPit(): Promise<Pit> {
    this.progress("pit", "Reading PIT from device");
    const start = await this.command(Command.Pit, PitRequest.Get);
    if (start.cmd !== Command.Pit) {
      throw new Error(`Unexpected PIT response command: ${start.cmd}`);
    }
    const pitSize = start.value;
    if (pitSize <= 0 || pitSize > 1024 * 1024) {
      throw new Error(`Unreasonable PIT size: ${pitSize}`);
    }

    const chunks: Buffer[] = [];
    for (let offset = 0, index = 0; offset < pitSize; index += 1) {
      await this.transport.writeExact(
        packCommand(Command.Pit, PitRequest.Part, [index]),
      );
      const take = Math.min(PIT_CHUNK_SIZE, pitSize - offset);
      chunks.push(await this.transport.readExact(take, this.timeoutMs));
      offset += take;
      this.progress("pit", `Read PIT chunk ${index}`, offset, pitSize);
    }

    this.progress("pit", "Finalizing PIT read", pitSize, pitSize);
    assertAck(
      await this.command(Command.Pit, PitRequest.Complete),
      Command.Pit,
      "PIT complete",
    );
    this.progress("pit", "Parsing PIT", pitSize, pitSize);
    const pit = parsePit(Buffer.concat(chunks));
    this.progress(
      "pit",
      `PIT parsed (${pit.entries.length} entries)`,
      pitSize,
      pitSize,
    );
    return pit;
  }

  async writePit(data: Buffer | Uint8Array): Promise<void> {
    const pit = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (pit.byteLength === 0) {
      throw new Error("PIT payload is empty");
    }
    this.progress("pit", `Uploading PIT (${pit.byteLength} bytes)`);
    assertAck(
      await this.command(Command.Pit, PitRequest.Set),
      Command.Pit,
      "PIT set",
    );
    assertAck(
      await this.command(Command.Pit, PitRequest.Part, [pit.byteLength]),
      Command.Pit,
      "PIT begin",
    );
    await this.transport.writeExact(pit);
    assertAck(
      unpackResponse(await this.transport.readExact(8, this.timeoutMs)),
      Command.Pit,
      "PIT data",
    );
    assertAck(
      await this.command(Command.Pit, PitRequest.Complete, [pit.byteLength]),
      Command.Pit,
      "PIT upload complete",
    );
  }

  async sendFile(
    path: string,
    size: number,
    entry: PitEntry,
    isLast: boolean,
  ): Promise<void> {
    await this.sendFileRegion(path, 0, size, entry, isLast);
  }

  async sendFileRegion(
    path: string,
    offset: number,
    size: number,
    entry: PitEntry,
    isLast: boolean,
  ): Promise<void> {
    await this.sendByteStream(
      entry.flashFilename || path,
      size,
      createReadStreamRange(path, offset, size),
      entry,
      isLast,
    );
  }

  async sendByteStream(
    name: string,
    size: number | bigint,
    chunks: AsyncIterable<Buffer | Uint8Array>,
    entry: PitEntry,
    isLast: boolean,
  ): Promise<void> {
    const totalSize = checkedNumber(size, "transfer size");
    let sequenceRemaining = 0;
    let sequenceWritten = 0;
    let sequence = 0;
    let pending = Buffer.alloc(0);

    this.progress("transfer", `Preparing ${name}`, 0, totalSize);
    for await (const rawChunk of chunks) {
      const chunk = Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(
            rawChunk.buffer,
            rawChunk.byteOffset,
            rawChunk.byteLength,
          );
      pending = Buffer.concat([pending, chunk]);
      while (pending.byteLength > 0) {
        if (sequenceRemaining === 0) {
          const bytesLeft = totalSize - sequence * this.maxTransferSequenceSize;
          const sequenceSize = Math.min(
            bytesLeft,
            this.maxTransferSequenceSize,
          );
          this.progress(
            "transfer",
            `Starting ${name} sequence ${sequence + 1}`,
            sequence * this.maxTransferSequenceSize,
            totalSize,
          );
          await this.beginTransferSequence(
            sequenceSize,
            name,
            sequence + 1,
            sequence * this.maxTransferSequenceSize,
            totalSize,
          );
          sequenceRemaining = sequenceSize;
          sequenceWritten = 0;
        }

        const take = Math.min(this.filePartSize, sequenceRemaining);
        if (pending.byteLength < take) break;

        const piece = pending.subarray(0, take);
        await this.writeTransferPart(piece);
        await this.transport.readExact(8, this.timeoutMs);
        sequenceWritten += piece.byteLength;
        sequenceRemaining -= piece.byteLength;
        this.progress(
          "transfer",
          name,
          Math.min(
            sequence * this.maxTransferSequenceSize + sequenceWritten,
            totalSize,
          ),
          totalSize,
        );
        pending = pending.subarray(take);

        if (sequenceRemaining === 0) {
          const sequenceIsLast =
            sequence * this.maxTransferSequenceSize + sequenceWritten >=
              totalSize && isLast;
          this.progress(
            "transfer",
            `Finishing ${name} sequence ${sequence + 1}`,
            Math.min(
              sequence * this.maxTransferSequenceSize + sequenceWritten,
              totalSize,
            ),
            totalSize,
          );
          await this.finishTransferSequence(
            sequenceWritten,
            entry,
            sequenceIsLast,
            name,
            sequence + 1,
            totalSize,
          );
          sequence += 1;
        }
      }
    }

    if (totalSize === 0 && sequence === 0) {
      await this.beginTransferSequence(0, name, 1, 0, totalSize);
      await this.finishTransferSequence(0, entry, isLast, name, 1, totalSize);
      return;
    }
    if (pending.byteLength > 0 || sequenceRemaining !== 0) {
      throw new Error(`Input stream ended early for ${name}`);
    }
    const expectedSequences = Math.ceil(
      totalSize / this.maxTransferSequenceSize,
    );
    if (sequence !== expectedSequences) {
      throw new Error(
        `Input stream length mismatch for ${name}: completed ${sequence} sequences, expected ${expectedSequences}`,
      );
    }
  }

  private async writeTransferPart(data: Buffer): Promise<void> {
    if (data.byteLength === this.filePartSize) {
      await this.transport.writeExact(data);
      return;
    }
    const part = Buffer.alloc(this.filePartSize);
    data.copy(part);
    await this.transport.writeExact(part);
  }

  private async beginTransferSequence(
    size: number,
    name: string,
    sequence: number,
    bytesWritten: number,
    totalBytes: number,
  ): Promise<void> {
    const roundedSize = roundUp(size, TRANSFER_ROUNDING);
    this.progress(
      "transfer",
      `Sending ${name} download command for sequence ${sequence}`,
      bytesWritten,
      totalBytes,
    );
    assertAck(
      await this.command(Command.Transfer, TransferRequest.Download),
      Command.Transfer,
      "transfer download",
    );
    this.progress(
      "transfer",
      `Sending ${name} start command for sequence ${sequence}`,
      bytesWritten,
      totalBytes,
    );
    assertAck(
      await this.command(Command.Transfer, TransferRequest.Start, [
        roundedSize,
      ]),
      Command.Transfer,
      "transfer start",
    );
  }

  private async finishTransferSequence(
    size: number,
    entry: PitEntry,
    isLast: boolean,
    name: string,
    sequence: number,
    totalBytes: number,
  ): Promise<void> {
    this.progress(
      "transfer",
      `Sending ${name} complete command for sequence ${sequence}`,
      Math.min(sequence * this.maxTransferSequenceSize, totalBytes),
      totalBytes,
    );
    assertAck(
      await this.command(Command.Transfer, TransferRequest.Complete, [
        entry.binaryType,
        size,
        0,
        entry.deviceType,
        entry.identifier,
        isLast ? 1 : 0,
        0,
        0,
      ]),
      Command.Transfer,
      "transfer complete",
    );
  }

  async close(reboot = true): Promise<void> {
    this.progress("close", "Closing Odin session");
    assertAck(
      await this.command(Command.Close, CloseRequest.EndSession),
      Command.Close,
      "close",
    );
    if (reboot) {
      assertAck(
        await this.command(Command.Close, CloseRequest.Reboot),
        Command.Close,
        "reboot",
      );
    }
  }

  private progress(
    phase: ProgressEvent["phase"],
    message: string,
    bytesWritten?: number,
    totalBytes?: number,
  ): void {
    const event: {
      phase: ProgressEvent["phase"];
      message: string;
      bytesWritten?: number;
      totalBytes?: number;
    } = { phase, message };
    if (bytesWritten !== undefined) event.bytesWritten = bytesWritten;
    if (totalBytes !== undefined) event.totalBytes = totalBytes;
    this.onProgress?.(event);
  }
}

function createReadStreamRange(
  path: string,
  offset: number,
  size: number,
): AsyncIterable<Buffer> {
  const streamOptions =
    size === 0
      ? {
          highWaterMark: DEFAULT_FILE_PART_SIZE,
          start: offset,
          end: offset - 1,
        }
      : {
          highWaterMark: DEFAULT_FILE_PART_SIZE,
          start: offset,
          end: offset + size - 1,
        };
  return createReadStream(path, streamOptions);
}

function checkedNumber(value: number | bigint, label: string): number {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new RangeError(
      `${label} is not a safe non-negative integer: ${value.toString()}`,
    );
  }
  return numeric;
}
