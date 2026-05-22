import test from "node:test";
import assert from "node:assert/strict";
import { OdinSession } from "../src/session.js";
import { Command, TransferRequest } from "../src/protocol/constants.js";
import type { PitEntry } from "../src/pit.js";
import type { OdinTransport } from "../src/transports/types.js";

class AckTransport implements OdinTransport {
  readonly description = "ack";
  readonly writes: Buffer[] = [];

  async open(): Promise<void> {}

  async close(): Promise<void> {}

  async writeExact(data: Buffer | Uint8Array): Promise<void> {
    this.writes.push(
      Buffer.isBuffer(data)
        ? Buffer.from(data)
        : Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    );
  }

  async readExact(size: number): Promise<Buffer> {
    const ack = Buffer.alloc(size);
    if (size >= 8) ack.writeUInt32LE(Command.Transfer, 0);
    return ack;
  }
}

const entry: PitEntry = {
  binaryType: 0,
  deviceType: 2,
  identifier: 10,
  attributes: 0,
  updateAttributes: 0,
  blockSizeOrOffset: 0,
  blockCount: 0,
  fileOffset: 0,
  fileSize: 0,
  partitionName: "RECOVERY",
  flashFilename: "recovery.img",
  fotaFilename: "",
};

test("sendByteStream writes padded fixed-size transfer parts", async () => {
  const transport = new AckTransport();
  const session = new OdinSession(transport, {
    filePartSize: 4,
    maxTransferSequenceSize: 8,
  });

  await session.sendByteStream(
    "recovery.img",
    3,
    chunks(Buffer.from("a"), Buffer.from("bc")),
    entry,
    true,
  );

  const dataWrites = transport.writes.filter((write) => write.byteLength === 4);
  assert.equal(dataWrites.length, 1);
  assert.equal(dataWrites[0]?.toString("hex"), "61626300");
});

test("sendByteStream splits fixed-size parts across transfer sequences", async () => {
  const transport = new AckTransport();
  const session = new OdinSession(transport, {
    filePartSize: 4,
    maxTransferSequenceSize: 8,
  });

  await session.sendByteStream(
    "recovery.img",
    9,
    chunks(Buffer.from("abcdefghi")),
    entry,
    true,
  );

  const commands = transport.writes
    .filter((write) => write.byteLength === 1024)
    .map((write) => [write.readUInt32LE(0), write.readUInt32LE(4)]);
  const dataWrites = transport.writes.filter((write) => write.byteLength === 4);

  assert.deepEqual(commands, [
    [Command.Transfer, TransferRequest.Download],
    [Command.Transfer, TransferRequest.Start],
    [Command.Transfer, TransferRequest.Complete],
    [Command.Transfer, TransferRequest.Download],
    [Command.Transfer, TransferRequest.Start],
    [Command.Transfer, TransferRequest.Complete],
  ]);
  assert.deepEqual(
    dataWrites.map((write) => write.toString("hex")),
    ["61626364", "65666768", "69000000"],
  );
});

async function* chunks(...items: Buffer[]): AsyncIterable<Buffer> {
  for (const item of items) yield item;
}
