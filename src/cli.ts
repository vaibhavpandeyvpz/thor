#!/usr/bin/env node
import { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./commands/types.js";
import { DevicesCommand } from "./commands/devices.js";
import { DoctorCommand } from "./commands/doctor.js";
import { PlanCommand } from "./commands/plan.js";
import { HandshakeCommand } from "./commands/handshake.js";
import { DeviceInfoCommand } from "./commands/device-info.js";
import { FlashCommand } from "./commands/flash.js";

const program = new CommanderCommand();

program
  .name("thor")
  .description("Samsung Odin/Loke flashing toolkit")
  .version("0.1.0");

const commands: CliCommand[] = [
  new DevicesCommand(),
  new DoctorCommand(),
  new PlanCommand(),
  new HandshakeCommand(),
  new DeviceInfoCommand(),
  new FlashCommand(),
];

for (const command of commands) {
  command.register(program);
}

await program.parseAsync();
