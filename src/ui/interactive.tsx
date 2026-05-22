import { readFile } from "node:fs/promises";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import {
  planFirmwarePackages,
  planFirmwareSlots,
  type FirmwareSlot,
  type FirmwareSlotInputs,
} from "../firmware/firmware.js";
import { createCompressedFile } from "../firmware/compression/factory.js";
import { OdinSession } from "../session.js";
import { listSerialPorts, SerialOdinTransport } from "../transports/serial.js";
import {
  classifyPort,
  platformHint,
  type ClassifiedSerialPort,
} from "../utils/port-finder.js";
import {
  CONFIRM_FLASH,
  FLASH_ACTIONS,
  FLASH_SLOT_ORDER,
  MANUAL_PORT,
  UTILITY_ACTIONS,
} from "./constants.js";
import { Header } from "./components/chrome.js";
import { FlashConfirmScreen } from "./screens/flash-confirm.js";
import { FlashOptionsScreen } from "./screens/flash-options.js";
import { FlashSlotsScreen } from "./screens/flash-slots.js";
import { HomeScreen } from "./screens/home.js";
import { PortPickerScreen } from "./screens/port-picker.js";
import { ResultScreen } from "./screens/result.js";
import { RunningScreen } from "./screens/running.js";
import { TextInputScreen } from "./screens/text-input.js";
import type {
  ActionId,
  HomeTab,
  ProgressState,
  ResultKind,
  ResultState,
  ResultView,
  Screen,
  SelectItem,
  TextPurpose,
} from "./types.js";
import {
  actionById,
  formatBytes,
  inputHelp,
  inputPlaceholder,
  inputTitle,
  needsPort,
  needsTextInput,
  packageItemLabel,
  progressBar,
} from "./utils/format.js";

export function InteractiveCliApp(): React.JSX.Element {
  const { exit } = useApp();
  const columns = process.stdout.columns ?? 100;
  const width = Math.max(82, Math.min(columns, 118));

  const [screen, setScreen] = useState<Screen>("home");
  const [homeTab, setHomeTab] = useState<HomeTab>("flash");
  const [selectedAction, setSelectedAction] = useState<ActionId>("devices");
  const [ports, setPorts] = useState<readonly ClassifiedSerialPort[]>([]);
  const [lastScan, setLastScan] = useState({ ports: 0, likely: 0 });
  const [input, setInput] = useState("");
  const [textPurpose, setTextPurpose] = useState<TextPurpose>("action-input");
  const [pendingSlot, setPendingSlot] = useState<FirmwareSlot | undefined>();
  const [flashSlots, setFlashSlots] = useState<FirmwareSlotInputs>({});
  const [flashPort, setFlashPort] = useState<string | undefined>();
  const [flashReboot, setFlashReboot] = useState(false);
  const [flashResetTime, setFlashResetTime] = useState(false);
  const [flashRepartition, setFlashRepartition] = useState(false);
  const [flashNandErase, setFlashNandErase] = useState(false);
  const [flashPitPath, setFlashPitPath] = useState<string | undefined>();
  const [flashConfirmation, setFlashConfirmation] = useState("");
  const [progress, setProgress] = useState<ProgressState | undefined>();
  const [result, setResult] = useState<ResultState>({
    kind: "info",
    title: "Welcome",
    lines: [
      "Choose a workflow from the picker.",
      "Device-writing operations are still explicit and guided.",
      "Review every flash plan carefully before confirmation.",
    ],
  });

  const refreshPorts = useCallback(async (): Promise<
    readonly ClassifiedSerialPort[]
  > => {
    const rows = (await listSerialPorts()).map((port) => classifyPort(port));
    const likely = rows.filter((row) => row.score >= 3);
    setPorts(rows);
    setLastScan({ ports: rows.length, likely: likely.length });
    return rows;
  }, []);

  useEffect(() => {
    void refreshPorts().catch((error) => {
      setResult({
        kind: "warning",
        title: "Initial device scan failed",
        lines: [error instanceof Error ? error.message : String(error)],
      });
    });
  }, [refreshPorts]);

  const setActionResult = useCallback(
    (kind: ResultKind, title: string, lines: readonly string[]) => {
      setResult({ kind, title, lines });
      setScreen("result");
    },
    [],
  );

  const runTask = useCallback(
    async (
      action: ActionId,
      task: () => Promise<{
        readonly kind?: ResultKind;
        readonly title: string;
        readonly lines: readonly string[];
        readonly view?: ResultView;
        readonly itemRows?: readonly string[];
      }>,
    ) => {
      setSelectedAction(action);
      setProgress(undefined);
      setScreen("running");
      try {
        const next = await task();
        const nextResult: {
          kind: ResultKind;
          title: string;
          lines: readonly string[];
          view?: ResultView;
          itemRows?: readonly string[];
        } = {
          kind: next.kind ?? "success",
          title: next.title,
          lines: next.lines,
        };
        if (next.view) nextResult.view = next.view;
        if (next.itemRows) nextResult.itemRows = next.itemRows;
        setResult(nextResult);
      } catch (error) {
        setResult({
          kind: "error",
          title: actionById(action).label,
          lines: [error instanceof Error ? error.message : String(error)],
        });
      } finally {
        setProgress(undefined);
        setScreen("result");
      }
    },
    [],
  );

  const runDevices = useCallback(async () => {
    await runTask("devices", async () => {
      const rows = await refreshPorts();
      const likely = rows.filter((row) => row.score >= 3);
      return {
        kind: likely.length > 0 ? ("success" as const) : ("warning" as const),
        title: `Device discovery: ${rows.length} port(s), ${likely.length} likely Odin`,
        lines:
          rows.length > 0
            ? rows.map((row) => {
                const reasons =
                  row.reasons.length > 0 ? ` (${row.reasons.join(", ")})` : "";
                return `${row.score >= 3 ? "*" : "-"} ${row.path}${reasons}`;
              })
            : [platformHint(process.platform)],
      };
    });
  }, [refreshPorts, runTask]);

  const runDoctor = useCallback(async () => {
    await runTask("doctor", async () => {
      const major = Number.parseInt(
        process.versions.node.split(".")[0] ?? "0",
        10,
      );
      const rows = await refreshPorts();
      const likely = rows.filter((row) => row.score >= 3);
      return {
        kind: major >= 20 ? ("success" as const) : ("warning" as const),
        title: "Doctor checks",
        lines: [
          `[${major >= 20 ? "PASS" : "FAIL"}] Node.js ${process.versions.node} (required >= 20)`,
          `[PASS] Serial enumeration: ${rows.length} port(s), ${likely.length} likely Odin`,
          platformHint(process.platform),
        ],
      };
    });
  }, [refreshPorts, runTask]);

  const runPlan = useCallback(
    async (raw: string) => {
      await runTask("plan", async () => {
        const paths = raw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        const plan = await planFirmwarePackages(paths);
        const rows = plan
          .firmwareItems()
          .map((item, index) => packageItemLabel(item, index));
        return {
          title: "Firmware package plan",
          lines: [
            `${plan.items().length} package(s)`,
            `${plan.firmwareItems().length} flash item(s)`,
            `transport: ${formatBytes(plan.totalTransportBytes)} (${plan.totalTransportBytes.toString()} bytes)`,
          ],
          view: "package-items" as const,
          itemRows: rows,
        };
      });
    },
    [runTask],
  );

  const runHandshake = useCallback(
    async (port: string) => {
      await runTask("handshake", async () => {
        const transport = new SerialOdinTransport({ path: port });
        await transport.open();
        try {
          const session = new OdinSession(transport);
          await session.handshake();
          return {
            title: "Handshake complete",
            lines: [`LOKE acknowledged on ${transport.description}`],
          };
        } finally {
          await transport.close();
        }
      });
    },
    [runTask],
  );

  const runPit = useCallback(
    async (port: string) => {
      await runTask("pit", async () => {
        const transport = new SerialOdinTransport({ path: port });
        await transport.open();
        try {
          const session = new OdinSession(transport);
          session.onProgress = progressHandler(setProgress);
          await session.handshake();
          await session.initialize(0);
          const pit = await session.readPit();
          return {
            title: "PIT read complete",
            lines: [
              `${pit.entries.length} entries`,
              ...pit.entries
                .slice(0, 10)
                .map(
                  (entry) =>
                    `${entry.identifier}: ${entry.partitionName} -> ${entry.flashFilename}`,
                ),
            ],
          };
        } finally {
          await transport.close();
        }
      });
    },
    [runTask],
  );

  const runFlash = useCallback(async () => {
    const port = flashPort;
    if (!port) {
      setActionResult("warning", "Flash firmware", [
        "Select a device port before flashing.",
      ]);
      return;
    }
    await runTask("flash", async () => {
      const plan = await planFirmwareSlots(flashSlots);
      const pitPayload =
        flashRepartition && flashPitPath
          ? await readFile(flashPitPath)
          : undefined;
      const transport = new SerialOdinTransport({ path: port });
      await transport.open();
      try {
        const session = new OdinSession(transport, {
          firmwareResetTime: flashResetTime,
          eraseNand: flashNandErase,
        });
        session.onProgress = progressHandler(setProgress);
        await session.handshake();
        const variant = await session.initialize(plan.totalTransportBytes);
        if (pitPayload) {
          await session.writePit(pitPayload);
        }
        const pit = await session.readPit();
        const firmwareItems = plan.firmwareItems();
        for (let index = 0; index < firmwareItems.length; index += 1) {
          const item = firmwareItems[index];
          if (!item) continue;
          const entry = pit.findByFlashFilename(item.name);
          if (!entry) {
            throw new Error(
              `No PIT entry matches firmware member ${item.name}`,
            );
          }
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
            index === firmwareItems.length - 1,
          );
        }
        await session.close(flashReboot);
        return {
          title: "Flash complete",
          lines: [
            `Protocol variant: ${variant}`,
            `${firmwareItems.length} item(s) flashed`,
            `transport: ${formatBytes(plan.totalTransportBytes)} (${plan.totalTransportBytes.toString()} bytes)`,
            flashResetTime
              ? "F. Reset Time command enabled."
              : "F. Reset Time command skipped.",
            flashRepartition
              ? `PIT repartition uploaded: ${flashPitPath}`
              : "Repartition skipped.",
            flashNandErase
              ? "NAND erase command enabled."
              : "NAND erase skipped.",
            flashReboot ? "Reboot command sent." : "Reboot command skipped.",
          ],
        };
      } finally {
        await transport.close();
      }
    });
  }, [
    flashNandErase,
    flashPitPath,
    flashPort,
    flashReboot,
    flashRepartition,
    flashResetTime,
    flashSlots,
    runTask,
    setActionResult,
  ]);

  const startAction = useCallback(
    (action: ActionId) => {
      setSelectedAction(action);
      setInput("");
      setTextPurpose("action-input");
      if (action === "exit") {
        exit();
        return;
      }
      if (action === "devices") {
        void runDevices();
        return;
      }
      if (action === "doctor") {
        void runDoctor();
        return;
      }
      if (action === "flash") {
        setFlashSlots({});
        setFlashPort(undefined);
        setFlashReboot(false);
        setFlashResetTime(false);
        setFlashRepartition(false);
        setFlashNandErase(false);
        setFlashPitPath(undefined);
        setFlashConfirmation("");
        setPendingSlot(undefined);
        setScreen("flash-slots");
        return;
      }
      if (needsPort(action)) {
        void refreshPorts().finally(() => setScreen("port-picker"));
        return;
      }
      if (needsTextInput(action)) {
        setScreen("text-input");
      }
    },
    [exit, refreshPorts, runDevices, runDoctor],
  );

  const submitInput = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (textPurpose === "flash-slot-path" && pendingSlot) {
        setFlashSlots((prev) => ({ ...prev, [pendingSlot]: trimmed }));
        setPendingSlot(undefined);
        setInput("");
        setTextPurpose("action-input");
        setScreen("flash-slots");
        return;
      }
      if (textPurpose === "flash-pit-path") {
        setFlashPitPath(trimmed);
        setInput("");
        setTextPurpose("action-input");
        setScreen("flash-options");
        return;
      }
      if (textPurpose === "manual-port" && selectedAction === "flash") {
        setFlashPort(trimmed);
        setInput("");
        setTextPurpose("action-input");
        setScreen("flash-confirm");
        return;
      }
      if (selectedAction === "plan") {
        void runPlan(trimmed);
      } else if (selectedAction === "handshake") {
        void runHandshake(trimmed);
      } else if (selectedAction === "pit") {
        void runPit(trimmed);
      } else if (selectedAction === "flash") {
        setFlashPort(trimmed);
        setScreen("flash-confirm");
      }
    },
    [pendingSlot, runHandshake, runPit, runPlan, selectedAction, textPurpose],
  );

  useInput((inputKey, key) => {
    if (inputKey === "\u0003") {
      exit();
      return;
    }
    if (screen === "home" && (key.leftArrow || key.rightArrow || key.tab)) {
      setHomeTab((current) => (current === "flash" ? "utilities" : "flash"));
      return;
    }
    if (key.escape) {
      setScreen("home");
      setInput("");
      setTextPurpose("action-input");
      return;
    }
    if (inputKey === "q" && (screen === "home" || screen === "result")) {
      exit();
      return;
    }
    if (inputKey === "b" && screen === "result") {
      setScreen("home");
    }
  });

  const actionItems: readonly SelectItem<ActionId>[] = useMemo(() => {
    const ids = homeTab === "flash" ? FLASH_ACTIONS : UTILITY_ACTIONS;
    return ids.map((id) => {
      const action = actionById(id);
      return {
        label: action.label,
        value: action.id,
      };
    });
  }, [homeTab]);

  const portItems: readonly SelectItem<string>[] = useMemo(() => {
    const rows = ports.map((port) => {
      const reasons =
        port.reasons.length > 0 ? ` (${port.reasons.join(", ")})` : "";
      return {
        label: `${port.score >= 3 ? "*" : "-"} ${port.path}${reasons}`,
        value: port.path,
      };
    });
    return [...rows, { label: "Enter port manually", value: MANUAL_PORT }];
  }, [ports]);

  const flashSlotItems: readonly SelectItem<string>[] = useMemo(() => {
    const slotRows = FLASH_SLOT_ORDER.map((slot) => ({
      label: `${slot.padEnd(8)} ${flashSlots[slot] ?? "(not set)"}`,
      value: slot,
    }));
    const hasSlots = Object.keys(flashSlots).length > 0;
    return [
      ...slotRows,
      {
        label: hasSlots
          ? "Continue to flash options"
          : "Continue to flash options (add at least one slot first)",
        value: "__continue__",
      },
      { label: "Back to workflows", value: "__back__" },
    ];
  }, [flashSlots]);

  const flashOptionItems: readonly SelectItem<string>[] = useMemo(
    () => [
      {
        label: flashReboot
          ? "Reboot after flash: yes"
          : "Reboot after flash: no",
        value: "__toggle_reboot__",
      },
      {
        label: flashResetTime ? "F. Reset Time: yes" : "F. Reset Time: no",
        value: "__toggle_reset_time__",
      },
      {
        label: flashRepartition
          ? "Repartition with PIT: yes"
          : "Repartition with PIT: no",
        value: "__toggle_repartition__",
      },
      {
        label: `PIT file: ${flashPitPath ?? "(not set)"}`,
        value: "__pit_path__",
      },
      {
        label: flashNandErase ? "NAND erase: yes" : "NAND erase: no",
        value: "__toggle_nand_erase__",
      },
      { label: "Continue to device selection", value: "__continue__" },
      { label: "Back to slot selection", value: "__back__" },
    ],
    [
      flashNandErase,
      flashPitPath,
      flashReboot,
      flashRepartition,
      flashResetTime,
    ],
  );

  const selected = actionById(selectedAction);
  const currentInputTitle =
    textPurpose === "flash-slot-path" && pendingSlot
      ? `${pendingSlot} package path`
      : textPurpose === "flash-pit-path"
        ? "PIT file path"
        : inputTitle(selectedAction);
  const currentInputHelp =
    textPurpose === "flash-slot-path" && pendingSlot
      ? `Enter the firmware package path for ${pendingSlot}.`
      : textPurpose === "flash-pit-path"
        ? "Enter the PIT file path to upload before flashing."
        : inputHelp(selectedAction);
  const currentInputPlaceholder =
    textPurpose === "flash-slot-path" && pendingSlot
      ? `/path/${pendingSlot}.tar.md5`
      : textPurpose === "flash-pit-path"
        ? "/path/device.pit"
        : inputPlaceholder(selectedAction);

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      <Header action={selected} lastScan={lastScan} />

      {progress ? (
        <Box marginBottom={1}>
          <Text color="cyan">
            {progress.label} {progressBar(progress)}
          </Text>
        </Box>
      ) : null}

      {screen === "home" ? (
        <HomeScreen tab={homeTab} items={actionItems} onSelect={startAction} />
      ) : null}

      {screen === "port-picker" ? (
        <PortPickerScreen
          action={selected}
          items={portItems}
          onSelect={(value) => {
            if (value === MANUAL_PORT) {
              setInput("");
              setTextPurpose("manual-port");
              setScreen("text-input");
            } else {
              submitInput(value);
            }
          }}
        />
      ) : null}

      {screen === "flash-slots" ? (
        <FlashSlotsScreen
          action={selected}
          items={flashSlotItems}
          onSelect={(value) => {
            if (value === "__back__") {
              setScreen("home");
              return;
            }
            if (value === "__continue__") {
              if (Object.keys(flashSlots).length === 0) {
                setActionResult("warning", "Flash firmware", [
                  "Add at least one slot package before continuing.",
                ]);
                return;
              }
              setScreen("flash-options");
              return;
            }
            const slot = value as FirmwareSlot;
            setPendingSlot(slot);
            setInput(flashSlots[slot] ?? "");
            setTextPurpose("flash-slot-path");
            setScreen("text-input");
          }}
        />
      ) : null}

      {screen === "flash-options" ? (
        <FlashOptionsScreen
          action={selected}
          items={flashOptionItems}
          onSelect={(value) => {
            if (value === "__back__") {
              setScreen("flash-slots");
              return;
            }
            if (value === "__toggle_reboot__") {
              setFlashReboot((current) => !current);
              return;
            }
            if (value === "__toggle_reset_time__") {
              setFlashResetTime((current) => !current);
              return;
            }
            if (value === "__toggle_repartition__") {
              if (flashRepartition) {
                setFlashRepartition(false);
                setFlashNandErase(false);
                setFlashPitPath(undefined);
              } else {
                setFlashRepartition(true);
                setInput(flashPitPath ?? "");
                setTextPurpose("flash-pit-path");
                setScreen("text-input");
              }
              return;
            }
            if (value === "__pit_path__") {
              if (!flashRepartition) {
                setActionResult("warning", "PIT file", [
                  "Enable repartition before selecting a PIT file.",
                ]);
                return;
              }
              setInput(flashPitPath ?? "");
              setTextPurpose("flash-pit-path");
              setScreen("text-input");
              return;
            }
            if (value === "__toggle_nand_erase__") {
              if (!flashRepartition || !flashPitPath) {
                setActionResult("warning", "NAND erase", [
                  "NAND erase requires repartition and a PIT file.",
                ]);
                return;
              }
              setFlashNandErase((current) => !current);
              return;
            }
            if (value === "__continue__") {
              if (flashRepartition && !flashPitPath) {
                setActionResult("warning", "PIT file required", [
                  "Repartition requires a PIT file before continuing.",
                ]);
                return;
              }
              void refreshPorts().finally(() => setScreen("port-picker"));
            }
          }}
        />
      ) : null}

      {screen === "flash-confirm" ? (
        <FlashConfirmScreen
          action={selected}
          slots={flashSlots}
          port={flashPort}
          reboot={flashReboot}
          resetTime={flashResetTime}
          repartition={flashRepartition}
          pitPath={flashPitPath}
          nandErase={flashNandErase}
          confirmation={flashConfirmation}
          onConfirmationChange={setFlashConfirmation}
          onSubmit={(value) => {
            if (value.trim() === CONFIRM_FLASH) {
              setFlashConfirmation("");
              void runFlash();
            } else {
              setActionResult("warning", "Flash cancelled", [
                `Confirmation did not match ${CONFIRM_FLASH}.`,
              ]);
            }
          }}
        />
      ) : null}

      {screen === "text-input" ? (
        <TextInputScreen
          action={selected}
          title={currentInputTitle}
          help={currentInputHelp}
          placeholder={currentInputPlaceholder}
          value={input}
          onChange={setInput}
          onSubmit={submitInput}
        />
      ) : null}

      {screen === "running" ? <RunningScreen action={selected} /> : null}

      {screen === "result" ? (
        <ResultScreen
          action={selected}
          result={result}
          onSelect={(value) => {
            if (value === "back") {
              setScreen("home");
            } else if (value === "again") {
              startAction(selectedAction);
            } else if (value === "exit") {
              exit();
            }
          }}
        />
      ) : null}
    </Box>
  );
}

function progressHandler(setProgress: (progress: ProgressState) => void) {
  return (event: {
    readonly phase: string;
    readonly message: string;
    readonly bytesWritten?: number;
    readonly totalBytes?: number;
  }) => {
    if (event.bytesWritten !== undefined && event.totalBytes !== undefined) {
      setProgress({
        label: `${event.phase}: ${event.message}`,
        current: event.bytesWritten,
        total: event.totalBytes,
      });
    }
  };
}
