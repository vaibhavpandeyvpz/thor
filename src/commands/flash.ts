import { readFile } from "node:fs/promises";
import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "./types.js";
import {
  planFirmwareSlots,
  type FirmwareItem,
  type FirmwareSlot,
  type FirmwareSlotInputs,
} from "../firmware/firmware.js";
import { createCompressedFile } from "../firmware/compression/factory.js";
import type { PitEntry } from "../pit.js";
import { OdinSession } from "../session.js";
import { SerialOdinTransport } from "../transports/serial.js";
import { CliIO } from "../utils/cli-io.js";

interface SlotOptions {
  readonly bl?: string;
  readonly ap?: string;
  readonly cp?: string;
  readonly csc?: string;
  readonly userdata?: string;
}

interface FlashOptions extends SlotOptions {
  readonly port: string;
  readonly pit?: string;
  readonly repartition?: boolean;
  readonly nandErase?: boolean;
  readonly fResetTime?: boolean;
  readonly reboot?: boolean;
  readonly iUnderstandThisCanBrick?: boolean;
}

export class FlashCommand implements CliCommand {
  private readonly io = new CliIO();

  register(program: CommanderCommand): void {
    program
      .command("flash")
      .description(
        "Guarded flashing entry point. This is intentionally conservative.",
      )
      .option("--bl <path>", "BL slot package")
      .option("--ap <path>", "AP slot package")
      .option("--cp <path>", "CP slot package")
      .option("--csc <path>", "CSC slot package")
      .option("--userdata <path>", "USERDATA slot package")
      .option("--pit <path>", "PIT file path (requires --repartition)")
      .option(
        "--repartition",
        "Upload PIT to device before flashing (dangerous)",
      )
      .option(
        "--nand-erase",
        "Erase NAND/userdata before flashing (requires --pit and --repartition)",
      )
      .option("--port <path>", "serial port path")
      .option(
        "--f-reset-time",
        "enable firmware reset time command (disabled by default)",
      )
      .option("--reboot", "reboot device after flash (disabled by default)")
      .option(
        "--i-understand-this-can-brick",
        "required to actually contact the device",
      )
      .action(this.action.bind(this));
  }

  private async action(options: FlashOptions): Promise<void> {
    this.validateFlashOptions(options);
    const plan = await this.planFlashInput(options);
    const pitPayload = options.pit ? await readFile(options.pit) : undefined;
    if (!options.iUnderstandThisCanBrick) {
      this.io.line(
        "Flash plan computed, but no device was contacted. Re-run with --i-understand-this-can-brick to proceed.",
      );
      this.io.line(
        JSON.stringify(
          {
            plan,
            options: {
              repartition: options.repartition ?? false,
              pit: options.pit,
              nandErase: options.nandErase ?? false,
              firmwareResetTime: options.fResetTime ?? false,
              reboot: options.reboot ?? false,
            },
          },
          (_, value) => (typeof value === "bigint" ? value.toString() : value),
          2,
        ),
      );
      return;
    }
    const transport = new SerialOdinTransport({ path: options.port });
    await transport.open();
    try {
      const session = new OdinSession(transport, {
        firmwareResetTime: options.fResetTime ?? false,
        eraseNand: options.nandErase ?? false,
      });
      session.onProgress = (event) => {
        const suffix = event.totalBytes
          ? ` ${event.bytesWritten ?? 0}/${event.totalBytes}`
          : "";
        this.io.line(`[${event.phase}] ${event.message}${suffix}`);
      };
      await session.handshake();
      const variant = await session.initialize(plan.totalTransportBytes);
      this.io.line(`Protocol variant ${variant}`);
      if (pitPayload && options.repartition) {
        await session.writePit(pitPayload);
      }
      const pit = await session.readPit();
      const firmwareItems = plan.firmwareItems();
      for (let i = 0; i < firmwareItems.length; i += 1) {
        const item = firmwareItems[i];
        if (!item) continue;
        const entry = pit.findByFlashFilename(item.name);
        if (!entry) {
          throw new Error(`No PIT entry matches firmware member ${item.name}`);
        }
        await this.sendFirmwareItem(
          session,
          item,
          entry,
          i === firmwareItems.length - 1,
        );
      }
      await session.close(options.reboot ?? false);
    } finally {
      await transport.close();
    }
  }

  private async planFlashInput(options: SlotOptions) {
    const slotInputs = this.slotInputsFromOptions(options);
    if (Object.keys(slotInputs).length === 0) {
      throw new Error(
        "Provide at least one slot package: --bl/--ap/--cp/--csc/--userdata",
      );
    }
    return planFirmwareSlots(slotInputs);
  }

  private slotInputsFromOptions(options: SlotOptions): FirmwareSlotInputs {
    const inputs: FirmwareSlotInputs = {};
    this.setSlot(inputs, "BL", options.bl);
    this.setSlot(inputs, "AP", options.ap);
    this.setSlot(inputs, "CP", options.cp);
    this.setSlot(inputs, "CSC", options.csc);
    this.setSlot(inputs, "USERDATA", options.userdata);
    return inputs;
  }

  private setSlot(
    inputs: FirmwareSlotInputs,
    slot: FirmwareSlot,
    value: string | undefined,
  ): void {
    if (value) inputs[slot] = value;
  }

  private validateFlashOptions(options: FlashOptions): void {
    if (options.repartition && !options.pit) {
      throw new Error("--repartition requires --pit <path>");
    }
    if (options.pit && !options.repartition) {
      throw new Error("--pit requires --repartition");
    }
    if (options.nandErase && (!options.repartition || !options.pit)) {
      throw new Error("--nand-erase requires --pit <path> and --repartition");
    }
  }

  private async sendFirmwareItem(
    session: OdinSession,
    item: FirmwareItem,
    entry: PitEntry,
    isLast: boolean,
  ): Promise<void> {
    const file = createCompressedFile(
      item.path,
      item.offset,
      item.size.compressed,
      item.compression,
    );
    await session.sendByteStream(
      item.name,
      item.size.actual,
      file.decode(),
      entry,
      isLast,
    );
  }
}
