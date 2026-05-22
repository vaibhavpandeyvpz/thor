import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ActionId, HomeTab, SelectItem } from "../types.js";
import { Footer } from "../components/chrome.js";

export function HomeScreen({
  tab,
  items,
  onSelect,
}: {
  readonly tab: HomeTab;
  readonly items: readonly SelectItem<ActionId>[];
  readonly onSelect: (action: ActionId) => void;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="gray">
          Choose a workflow. Flashing requires a final explicit confirmation.
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={tab === "flash" ? "cyan" : "gray"} bold={tab === "flash"}>
          Flash
        </Text>
        <Text color="gray"> | </Text>
        <Text
          color={tab === "utilities" ? "cyan" : "gray"}
          bold={tab === "utilities"}
        >
          Utilities
        </Text>
      </Box>
      <SelectInput<ActionId>
        items={[...items]}
        onSelect={(item) => onSelect(item.value)}
      />
      <Footer hint="left/right/tab: switch tab | enter: select | q/ctrl+c: exit" />
    </Box>
  );
}
