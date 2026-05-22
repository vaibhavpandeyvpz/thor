import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type {
  FirmwareSlot,
  FirmwareSlotInputs,
} from "../../firmware/firmware.js";
import type { Action } from "../types.js";
import { CONFIRM_FLASH, FLASH_SLOT_ORDER } from "../constants.js";
import { Footer, StepTitle } from "../components/chrome.js";

export function FlashConfirmScreen({
  action,
  slots,
  port,
  reboot,
  resetTime,
  repartition,
  pitPath,
  nandErase,
  confirmation,
  onConfirmationChange,
  onSubmit,
}: {
  readonly action: Action;
  readonly slots: FirmwareSlotInputs;
  readonly port: string | undefined;
  readonly reboot: boolean;
  readonly resetTime: boolean;
  readonly repartition: boolean;
  readonly pitPath: string | undefined;
  readonly nandErase: boolean;
  readonly confirmation: string;
  readonly onConfirmationChange: (value: string) => void;
  readonly onSubmit: (value: string) => void;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <StepTitle step="Confirm flash" action={action} />
      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        flexDirection="column"
      >
        <Text color="yellow" bold>
          This can brick your device.
        </Text>
        <Text>Port: {port ?? "(not selected)"}</Text>
        {FLASH_SLOT_ORDER.filter((slot: FirmwareSlot) => slots[slot]).map(
          (slot) => (
            <Text key={slot}>
              {slot}: {slots[slot]}
            </Text>
          ),
        )}
        <Text>Reboot after flash: {reboot ? "yes" : "no"}</Text>
        <Text>F. Reset Time: {resetTime ? "yes" : "no"}</Text>
        <Text>Repartition: {repartition ? "yes" : "no"}</Text>
        <Text>PIT file: {pitPath ?? "(none)"}</Text>
        <Text>NAND erase: {nandErase ? "yes" : "no"}</Text>
        <Text color="gray">Type {CONFIRM_FLASH} to start flashing.</Text>
      </Box>
      <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text color="gray">{"> "}</Text>
        <TextInput
          value={confirmation}
          placeholder={CONFIRM_FLASH}
          onChange={onConfirmationChange}
          onSubmit={onSubmit}
        />
      </Box>
      <Footer hint="enter: confirm | esc: back | ctrl+c: exit" />
    </Box>
  );
}
