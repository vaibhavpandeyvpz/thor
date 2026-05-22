export interface OdinTransport {
  readonly description: string;
  open(): Promise<void>;
  close(): Promise<void>;
  writeExact(data: Buffer | Uint8Array): Promise<void>;
  readExact(size: number, timeoutMs?: number): Promise<Buffer>;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}
