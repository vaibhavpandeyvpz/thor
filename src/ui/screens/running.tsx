import React from "react";
import { Box, Text } from "ink";
import type { Action } from "../types.js";
import { StepTitle } from "../components/chrome.js";

export function RunningScreen({
  action,
}: {
  readonly action: Action;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <StepTitle step="Working" action={action} />
      <Text color="yellow">Running {action.label.toLowerCase()}...</Text>
      <Text color="gray">Please wait.</Text>
    </Box>
  );
}
