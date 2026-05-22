import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./types.js";
import { listSerialPorts } from "../transports/serial.js";
import { CliIO } from "../utils/cli-io.js";
import { classifyPort, platformHint } from "../utils/port-finder.js";

interface DevicesOptions {
  readonly json?: boolean;
}

export class DevicesCommand implements CliCommand {
  private readonly io = new CliIO();

  register(program: CommanderCommand): void {
    program
      .command("devices")
      .description("List serial devices with Odin-focused hints")
      .option("--json", "print raw JSON output")
      .action(this.action.bind(this));
  }

  private async action(options: DevicesOptions): Promise<void> {
    const ports = await listSerialPorts();
    const rows = ports.map((port) => classifyPort(port));
    if (options.json) {
      this.io.line(JSON.stringify(rows, null, 2));
      return;
    }
    if (rows.length === 0) {
      this.io.line("No serial ports detected.");
      this.io.line(platformHint(process.platform));
      return;
    }
    for (const row of rows) {
      const marker = row.score >= 3 ? "*" : " ";
      const tags = row.reasons.length > 0 ? ` (${row.reasons.join(", ")})` : "";
      this.io.line(`${marker} ${row.path}${tags}`);
    }
    const top = rows.filter((row) => row.score >= 3);
    if (top.length > 0) {
      this.io.line("");
      this.io.line("Likely Odin ports:");
      for (const row of top) {
        this.io.line(`- ${row.path}`);
      }
    }
    this.io.line("");
    this.io.line(platformHint(process.platform));
  }
}
