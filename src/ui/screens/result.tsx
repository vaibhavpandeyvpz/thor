import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { Action, ResultAction, ResultState } from "../types.js";
import { Footer, ResultBox, StepTitle } from "../components/chrome.js";
import { resultColor } from "../utils/format.js";

export function ResultScreen({
  action,
  result,
  onSelect,
}: {
  readonly action: Action;
  readonly result: ResultState;
  readonly onSelect: (value: ResultAction) => void;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <StepTitle step="Result" action={action} />
      <ResultBox kind={result.kind}>
        <Text color={resultColor(result.kind)} bold>
          {result.title}
        </Text>
        {result.lines.map((line, index) => (
          <Text key={`${index}-${line}`}>{line}</Text>
        ))}
        {result.view === "package-items" && result.itemRows ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray">Package contents:</Text>
            {result.itemRows.slice(0, 5).map((line, index) => (
              <Text key={`${index}-${line}`}>{line}</Text>
            ))}
            {result.itemRows.length > 5 ? (
              <Text color="gray">
                and {result.itemRows.length - 5} more item(s)
              </Text>
            ) : null}
          </Box>
        ) : null}
      </ResultBox>
      <Box marginTop={1}>
        <SelectInput<ResultAction>
          items={[
            { label: "Back to workflows", value: "back" },
            { label: `Run ${action.label} again`, value: "again" },
            { label: "Exit", value: "exit" },
          ]}
          onSelect={(item) => onSelect(item.value)}
        />
      </Box>
      <Footer hint="b: back | q/ctrl+c: exit" />
    </Box>
  );
}
