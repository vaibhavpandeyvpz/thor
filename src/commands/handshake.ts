import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./types.js";
import { SerialOdinTransport } from "../transports/serial.js";
import { OdinSession } from "../session.js";
import { CliIO } from "../utils/cli-io.js";

interface HandshakeOptions {
  readonly port?: string;
}

export class HandshakeCommand implements CliCommand {
  private readonly io = new CliIO();

  register(program: CommanderCommand): void {
    program
      .command("handshake")
      .description("Open a device and perform only ODIN/LOKE handshake")
      .option("--port <path>", "serial port path, e.g. COM1 or \\\\.\\COM1")
      .action(this.action.bind(this));
  }

  private async action(options: HandshakeOptions): Promise<void> {
    const transport = new SerialOdinTransport({ path: options.port ?? "COM1" });
    await transport.open();
    try {
      const session = new OdinSession(transport);
      await session.handshake();
      this.io.line(`LOKE handshake OK on ${transport.description}`);
    } finally {
      await transport.close();
    }
  }
}
