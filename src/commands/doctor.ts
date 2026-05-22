import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./types.js";
import { SerialOdinTransport, listSerialPorts } from "../transports/serial.js";
import { CliIO } from "../utils/cli-io.js";
import {
  classifyPort,
  errorMessage,
  platformHint,
} from "../utils/port-finder.js";

interface DoctorOptions {
  readonly port?: string;
}

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export class DoctorCommand implements CliCommand {
  private readonly io = new CliIO();

  register(program: CommanderCommand): void {
    program
      .command("doctor")
      .description("Run cross-platform environment and serial preflight checks")
      .option(
        "--port <path>",
        "optional port to open/close as a permission check",
      )
      .action(this.action.bind(this));
  }

  private async action(options: DoctorOptions): Promise<void> {
    const checks: CheckResult[] = [];
    const major = Number.parseInt(
      process.versions.node.split(".")[0] ?? "0",
      10,
    );
    checks.push({
      name: "Node.js version",
      ok: major >= 20,
      detail: `${process.versions.node} (required >= 20)`,
    });

    try {
      const ports = await listSerialPorts();
      const candidates = ports
        .map((port) => classifyPort(port))
        .filter((row) => row.score >= 3);
      checks.push({
        name: "Serial enumeration",
        ok: true,
        detail: `${ports.length} port(s), ${candidates.length} likely Odin`,
      });
    } catch (error) {
      checks.push({
        name: "Serial enumeration",
        ok: false,
        detail: errorMessage(error),
      });
    }

    if (options.port) {
      const transport = new SerialOdinTransport({ path: options.port });
      try {
        await transport.open();
        checks.push({
          name: `Port open (${options.port})`,
          ok: true,
          detail: "Open/close succeeded",
        });
      } catch (error) {
        checks.push({
          name: `Port open (${options.port})`,
          ok: false,
          detail: errorMessage(error),
        });
      } finally {
        await transport.close().catch(() => undefined);
      }
    }

    for (const check of checks) {
      const status = check.ok ? "PASS" : "FAIL";
      this.io.line(`[${status}] ${check.name}: ${check.detail}`);
    }
    this.io.line("");
    this.io.line(platformHint(process.platform));
  }
}
