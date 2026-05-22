#!/usr/bin/env node
import React from "react";
import { Command as CommanderCommand } from "commander";
import { render } from "ink";
import type { CliCommand } from "./commands/types.js";
import { DevicesCommand } from "./commands/devices.js";
import { DoctorCommand } from "./commands/doctor.js";
import { PlanCommand } from "./commands/plan.js";
import { HandshakeCommand } from "./commands/handshake.js";
import { FlashCommand } from "./commands/flash.js";
import { InteractiveCliApp } from "./ui/interactive.js";
import pkg from "../package.json" with { type: "json" };

const program = new CommanderCommand();

program.name(pkg.name).description(pkg.description).version(pkg.version);

const commands: CliCommand[] = [
  new DevicesCommand(),
  new DoctorCommand(),
  new PlanCommand(),
  new HandshakeCommand(),
  new FlashCommand(),
];

for (const command of commands) {
  command.register(program);
}

if (process.argv.length <= 2) {
  render(React.createElement(InteractiveCliApp));
} else {
  await program.parseAsync();
}
