import React from "react";
import SelectInput from "ink-select-input";
import { Box } from "ink";
import type { Action, SelectItem } from "../types.js";
import { Footer, StepTitle } from "../components/chrome.js";

export function PortPickerScreen({
  action,
  items,
  onSelect,
}: {
  readonly action: Action;
  readonly items: readonly SelectItem<string>[];
  readonly onSelect: (value: string) => void;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <StepTitle step="Select device port" action={action} />
      <SelectInput<string>
        items={[...items]}
        onSelect={(item) => onSelect(item.value)}
      />
      <Footer hint="enter: use port | esc: back | ctrl+c: exit" />
    </Box>
  );
}
