import React from "react";
import { Box, Text } from "ink";
import type { Action } from "../types.js";
import { resultColor, riskColor } from "../utils/format.js";
import type { ResultKind } from "../types.js";

export function Header({
  action,
  lastScan,
}: {
  readonly action: Action;
  readonly lastScan: { readonly ports: number; readonly likely: number };
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text color="cyan" bold>
          thorjs
        </Text>
        <Text color="gray"> Samsung Odin/Loke toolkit</Text>
      </Text>
      <Text>
        <Text color="gray">selected: </Text>
        <Text>{action.label}</Text>
        <Text color="gray"> | safety: </Text>
        <Text color={riskColor(action.risk)}>{action.risk}</Text>
        <Text color="gray"> | likely ports: </Text>
        <Text color={lastScan.likely > 0 ? "green" : "yellow"}>
          {lastScan.likely}/{lastScan.ports}
        </Text>
      </Text>
    </Box>
  );
}

export function StepTitle({
  step,
  action,
}: {
  readonly step: string;
  readonly action: Action;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>{step}</Text>
      <Text color="gray">{action.description}</Text>
    </Box>
  );
}

export function Footer({ hint }: { readonly hint: string }): React.JSX.Element {
  return (
    <Box marginTop={1}>
      <Text color="gray">{hint}</Text>
    </Box>
  );
}

export function ResultBox({
  kind,
  children,
}: {
  readonly kind: ResultKind;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box
      borderStyle="round"
      borderColor={resultColor(kind)}
      paddingX={1}
      flexDirection="column"
    >
      {children}
    </Box>
  );
}
