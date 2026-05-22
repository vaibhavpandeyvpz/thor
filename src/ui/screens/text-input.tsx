import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { Action } from "../types.js";
import { Footer, StepTitle } from "../components/chrome.js";

export function TextInputScreen({
  action,
  title,
  help,
  placeholder,
  value,
  onChange,
  onSubmit,
}: {
  readonly action: Action;
  readonly title: string;
  readonly help: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (value: string) => void;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <StepTitle step={title} action={action} />
      <Text color="gray">{help}</Text>
      <Box marginTop={1} borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="gray">{"> "}</Text>
        <TextInput
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </Box>
      <Footer hint="enter: continue | esc: back | ctrl+c: exit" />
    </Box>
  );
}
