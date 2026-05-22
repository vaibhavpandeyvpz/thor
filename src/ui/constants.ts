import type { FirmwareSlot } from "../firmware/firmware.js";
import type { Action, ActionId } from "./types.js";

export const ACTIONS: readonly Action[] = [
  {
    id: "devices",
    label: "List devices",
    description:
      "Scan serial ports and highlight likely Samsung Download Mode devices.",
    risk: "safe",
  },
  {
    id: "doctor",
    label: "Troubleshoot",
    description:
      "Check Node.js, serial enumeration, and platform-specific setup hints.",
    risk: "safe",
  },
  {
    id: "plan",
    label: "Plan firmware",
    description:
      "Inspect package contents and transfer size without touching a device.",
    risk: "dry",
  },
  {
    id: "flash",
    label: "Flash firmware",
    description:
      "Select slot packages, choose a device, confirm risk, and flash firmware.",
    risk: "device",
  },
  {
    id: "handshake",
    label: "Test handshake",
    description: "Open a serial port and verify ODIN/LOKE communication.",
    risk: "device",
  },
  {
    id: "pit",
    label: "PIT from device",
    description: "Handshake, initialize, and download the device PIT table.",
    risk: "device",
  },
];

export const MANUAL_PORT = "__manual_port__";
export const FLASH_SLOT_ORDER: readonly FirmwareSlot[] = [
  "BL",
  "AP",
  "CP",
  "CSC",
  "USERDATA",
];
export const CONFIRM_FLASH = "FLASH";
export const FLASH_ACTIONS: readonly ActionId[] = ["plan", "flash"];
export const UTILITY_ACTIONS: readonly ActionId[] = [
  "devices",
  "handshake",
  "pit",
  "doctor",
];
