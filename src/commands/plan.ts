import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./types.js";
import { planFirmwarePackages } from "../firmware/firmware.js";
import { CliIO } from "../utils/cli-io.js";

export class PlanCommand implements CliCommand {
  private readonly io = new CliIO();

  register(program: CommanderCommand): void {
    program
      .command("plan <packages...>")
      .description(
        "Inspect one or more firmware packages without contacting a device",
      )
      .action(this.action.bind(this));
  }

  private async action(packages: string[]): Promise<void> {
    const plan = await planFirmwarePackages(packages);
    this.io.line(
      JSON.stringify(
        plan,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
    );
  }
}
