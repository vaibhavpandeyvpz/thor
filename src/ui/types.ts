import type { FirmwareSlot, FirmwareSlotInputs } from "../firmware/firmware.js";

export type ActionId =
  | "devices"
  | "doctor"
  | "handshake"
  | "device-info"
  | "plan"
  | "flash"
  | "pit"
  | "exit";

export type Screen =
  | "home"
  | "port-picker"
  | "text-input"
  | "flash-slots"
  | "flash-options"
  | "flash-confirm"
  | "running"
  | "result";
export type HomeTab = "flash" | "utilities";
export type ResultKind = "success" | "warning" | "error" | "info";
export type TextPurpose =
  | "action-input"
  | "manual-port"
  | "flash-slot-path"
  | "flash-pit-path";
export type ResultView = "normal" | "package-items";
export type ResultAction = "back" | "again" | "exit";

export type Action = {
  readonly id: ActionId;
  readonly label: string;
  readonly description: string;
  readonly risk: "safe" | "device" | "dry";
};

export type SelectItem<T extends string> = {
  readonly label: string;
  readonly value: T;
};

export type ProgressState = {
  readonly label: string;
  readonly current: number;
  readonly total: number;
};

export type ResultState = {
  readonly kind: ResultKind;
  readonly title: string;
  readonly lines: readonly string[];
  readonly view?: ResultView;
  readonly itemRows?: readonly string[];
};

export type FlashState = {
  readonly slots: FirmwareSlotInputs;
  readonly port?: string;
  readonly reboot: boolean;
  readonly resetTime: boolean;
  readonly repartition: boolean;
  readonly nandErase: boolean;
  readonly pitPath?: string;
  readonly confirmation: string;
  readonly pendingSlot?: FirmwareSlot;
};
