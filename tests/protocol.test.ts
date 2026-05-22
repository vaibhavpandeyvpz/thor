import test from "node:test";
import assert from "node:assert/strict";
import {
  packCommand,
  packInitTotalBytes,
  unpackResponse,
} from "../src/protocol/packet.js";

test("packCommand emits 1024-byte little-endian Odin packets", () => {
  const packet = packCommand(100, 0, [5]);
  assert.equal(packet.byteLength, 1024);
  assert.equal(
    packet.subarray(0, 12).toString("hex"),
    "640000000000000005000000",
  );
});

test("packInitTotalBytes matches captured 100/2 packet", () => {
  const packet = packInitTotalBytes(18_989_072);
  assert.equal(
    packet.subarray(0, 16).toString("hex"),
    "640000000200000010c0210100000000",
  );
});

test("unpackResponse reads 8-byte ACK-style response", () => {
  const response = unpackResponse(Buffer.from("6400000000000300", "hex"));
  assert.equal(response.cmd, 100);
  assert.equal(response.value, 196608);
});
