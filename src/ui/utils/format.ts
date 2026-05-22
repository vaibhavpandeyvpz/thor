import type {
  FirmwareItem,
  FirmwareSlotInputs,
} from "../../firmware/firmware.js";
import { ACTIONS } from "../constants.js";
import type { Action, ActionId, ProgressState, ResultKind } from "../types.js";

export function parseSlotAssignments(input: string): FirmwareSlotInputs {
  const out: FirmwareSlotInputs = {};
  for (const item of input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const [slotRaw, ...rest] = item.split("=");
    const slot = slotRaw?.trim().toUpperCase();
    const path = rest.join("=").trim();
    if (!slot || !path) continue;
    if (
      slot === "BL" ||
      slot === "AP" ||
      slot === "CP" ||
      slot === "CSC" ||
      slot === "USERDATA"
    ) {
      out[slot] = path;
    }
  }
  return out;
}

export function progressBar(progress: ProgressState, width = 34): string {
  const percent = Math.round(
    (progress.current / Math.max(1, progress.total)) * 100,
  );
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return `[${"=".repeat(filled)}${" ".repeat(width - filled)}] ${clamped.toString().padStart(3, " ")}%`;
}

export function riskColor(risk: Action["risk"]): string {
  if (risk === "device") return "yellow";
  if (risk === "dry") return "cyan";
  return "green";
}

export function resultColor(kind: ResultKind): string {
  if (kind === "success") return "green";
  if (kind === "warning") return "yellow";
  if (kind === "error") return "red";
  return "cyan";
}

export function formatBytes(value: bigint): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let n = Number(value);
  let unit = 0;
  while (n >= 1024 && unit < units.length - 1) {
    n /= 1024;
    unit += 1;
  }
  return `${n.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

export function packageItemLabel(item: FirmwareItem, index: number): string {
  const actual = formatBytes(item.size.actual);
  const compressed = formatBytes(BigInt(item.size.compressed));
  const compression = item.compression === "none" ? "raw" : item.compression;
  return `${String(index + 1).padStart(2, " ")}  ${item.name}  ${actual} actual / ${compressed} stored  ${compression}`;
}

export function actionById(id: ActionId): Action {
  const action = ACTIONS.find((item) => item.id === id);
  if (!action) throw new Error(`Unknown action: ${id}`);
  return action;
}

export function needsPort(action: ActionId): boolean {
  return action === "handshake" || action === "pit";
}

export function needsTextInput(action: ActionId): boolean {
  return action === "plan";
}

export function inputTitle(action: ActionId): string {
  if (action === "plan") return "Package paths";
  return "Serial port";
}

export function inputHelp(action: ActionId): string {
  if (action === "plan")
    return "Enter one or more package paths separated by commas.";
  return "Enter a serial port path, such as COM9, /dev/ttyACM0, or /dev/cu.usbmodem1234.";
}

export function inputPlaceholder(action: ActionId): string {
  if (action === "plan") return "/path/AP.tar.md5,/path/CSC.tar.md5";
  return "COM9";
}
