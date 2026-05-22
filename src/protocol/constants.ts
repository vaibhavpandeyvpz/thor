export const HANDSHAKE_OUT = Buffer.from("ODIN", "ascii");
export const HANDSHAKE_IN = Buffer.from("LOKE", "ascii");

export const COMMAND_PACKET_SIZE = 1024;
export const DEFAULT_FILE_PART_SIZE = 1024 * 1024;
export const DEFAULT_TRANSFER_SEQUENCE_SIZE = 30 * 1024 * 1024;
export const PIT_CHUNK_SIZE = 500;
export const TRANSFER_ROUNDING = 128 * 1024;

export enum Command {
  Init = 100,
  Pit = 101,
  Transfer = 102,
  Close = 103,
}

export enum InitRequest {
  Begin = 0,
  ResetTime = 1,
  TotalBytes = 2,
  FilePartSize = 5,
  EraseUserData = 7,
}

export enum PitRequest {
  Set = 0,
  Get = 1,
  Part = 2,
  Complete = 3,
}

export enum TransferRequest {
  Download = 0,
  Dump = 1,
  Start = 2,
  Complete = 3,
}

export enum CloseRequest {
  EndSession = 0,
  Reboot = 1,
}
