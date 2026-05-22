interface SerialPortLike {
  readonly path?: string;
  readonly manufacturer?: string;
  readonly pnpId?: string;
  readonly vendorId?: string;
  readonly productId?: string;
  readonly friendlyName?: string;
}

export interface ClassifiedSerialPort {
  readonly path: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export function classifyPort(port: unknown): ClassifiedSerialPort {
  const item = port as SerialPortLike;
  const path = item.path ?? "<unknown>";
  const tokens = [
    item.manufacturer,
    item.pnpId,
    item.friendlyName,
    item.vendorId,
    item.productId,
    path,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  const reasons: string[] = [];
  if (tokens.includes("samsung")) {
    score += 2;
    reasons.push("Samsung");
  }
  if (tokens.includes("04e8")) {
    score += 2;
    reasons.push("VID_04E8");
  }
  if (tokens.includes("685d") || tokens.includes("68c3")) {
    score += 2;
    reasons.push("Download PID");
  }
  if (tokens.includes("modem")) {
    score += 1;
    reasons.push("modem");
  }
  if (
    path.startsWith("COM") ||
    path.startsWith("/dev/ttyACM") ||
    path.startsWith("/dev/cu.")
  ) {
    score += 1;
  }
  return { path, score, reasons };
}

export function platformHint(platform: NodeJS.Platform): string {
  if (platform === "win32") {
    return "Windows hint: install Samsung USB/modem drivers and use COMx from `thor devices`.";
  }
  if (platform === "linux") {
    return "Linux hint: ensure udev permissions for /dev/ttyACM* and run `thor devices`.";
  }
  if (platform === "darwin") {
    return "macOS hint: look for /dev/cu.* ports and grant serial access if prompted.";
  }
  return "Hint: ensure your OS exposes the device as a serial port.";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
