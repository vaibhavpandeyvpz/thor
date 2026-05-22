import { SerialPort } from "serialport";
import { TimeoutError, type OdinTransport } from "./types.js";

export interface SerialOdinTransportOptions {
  readonly path: string;
  readonly baudRate?: number;
}

export class SerialOdinTransport implements OdinTransport {
  readonly description: string;
  private readonly path: string;
  private readonly baudRate: number;
  private port?: SerialPort;
  private pending = Buffer.alloc(0);
  private readers: Array<() => void> = [];

  constructor(options: SerialOdinTransportOptions) {
    this.path = options.path;
    this.baudRate = options.baudRate ?? 115200;
    this.description = `serial:${this.path}`;
  }

  async open(): Promise<void> {
    if (this.port?.isOpen) return;
    this.port = new SerialPort({
      path: this.path,
      baudRate: this.baudRate,
      autoOpen: false,
    });
    this.port.on("data", (chunk: Buffer) => {
      this.pending = Buffer.concat([this.pending, chunk]);
      this.wakeReaders();
    });
    await new Promise<void>((resolve, reject) => {
      this.port?.open((err) => (err ? reject(err) : resolve()));
    });
  }

  async close(): Promise<void> {
    if (!this.port?.isOpen) return;
    await new Promise<void>((resolve, reject) => {
      this.port?.close((err) => (err ? reject(err) : resolve()));
    });
  }

  async writeExact(data: Buffer | Uint8Array): Promise<void> {
    const buf = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const port = this.requirePort();
    await new Promise<void>((resolve, reject) => {
      port.write(buf, (writeErr) => {
        if (writeErr) {
          reject(writeErr);
          return;
        }
        port.drain((drainErr) => (drainErr ? reject(drainErr) : resolve()));
      });
    });
  }

  async readExact(size: number, timeoutMs = 60_000): Promise<Buffer> {
    const deadline = Date.now() + timeoutMs;
    while (this.pending.byteLength < size) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new TimeoutError(
          `Timed out reading ${size} bytes from ${this.description}`,
        );
      }
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.readers = this.readers.filter((r) => r !== done);
          reject(
            new TimeoutError(
              `Timed out reading ${size} bytes from ${this.description}`,
            ),
          );
        }, remaining);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        this.readers.push(done);
      });
    }
    const out = this.pending.subarray(0, size);
    this.pending = this.pending.subarray(size);
    return Buffer.from(out);
  }

  private requirePort(): SerialPort {
    if (!this.port?.isOpen) {
      throw new Error(`${this.description} is not open`);
    }
    return this.port;
  }

  private wakeReaders(): void {
    const readers = this.readers;
    this.readers = [];
    for (const reader of readers) reader();
  }
}

export async function listSerialPorts(): Promise<readonly unknown[]> {
  return SerialPort.list();
}
