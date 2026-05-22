import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { Action, SelectItem } from "../types.js";
import { Footer, StepTitle } from "../components/chrome.js";

export function FlashOptionsScreen({
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
      <StepTitle step="Flash options" action={action} />
      <Text color="gray">
        Choose the optional commands to send before closing the session.
      </Text>
      <Box marginTop={1}>
        <SelectInput<string>
          items={[...items]}
          onSelect={(item) => onSelect(item.value)}
        />
      </Box>
      <Footer hint="enter: toggle/select | esc: back | ctrl+c: exit" />
    </Box>
  );
}
