import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./types.js";
import { SerialOdinTransport } from "../transports/serial.js";
import { OdinSession } from "../session.js";
import { CliIO } from "../utils/cli-io.js";

interface DeviceInfoOptions {
  readonly port: string;
}

export class DeviceInfoCommand implements CliCommand {
  private readonly io = new CliIO();

  register(program: CommanderCommand): void {
    program
      .command("device-info")
      .description(
        "Open a device, handshake, and request DVIF device information",
      )
      .requiredOption(
        "--port <path>",
        "serial port path, e.g. COM1 or \\\\.\\COM1",
      )
      .action(this.action.bind(this));
  }

  private async action(options: DeviceInfoOptions): Promise<void> {
    const transport = new SerialOdinTransport({ path: options.port });
    await transport.open();
    try {
      const session = new OdinSession(transport);
      await session.handshake();
      const info = await session.readDeviceInfo();
      this.io.line(
        JSON.stringify(
          {
            text: info.text,
            fields: info.fields,
          },
          null,
          2,
        ),
      );
    } finally {
      await transport.close();
    }
  }
}
