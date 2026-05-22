import test from "node:test";
import assert from "node:assert/strict";
import { parseDeviceInfoText } from "../src/session.js";

test("parseDeviceInfoText parses Odin-style key/value payload", () => {
  const parsed = parseDeviceInfoText(
    "#product=SM-S901E;model=SM-S901E;fwver=S901EXXU1;@sales=INS;",
  );
  assert.deepEqual(parsed, {
    product: "SM-S901E",
    model: "SM-S901E",
    fwver: "S901EXXU1",
    sales: "INS",
  });
});

test("parseDeviceInfoText ignores malformed fragments", () => {
  const parsed = parseDeviceInfoText("garbage;keyonly=;=novalue;did=12345");
  assert.deepEqual(parsed, {
    did: "12345",
  });
});
