"use client";

import {
  useCopilotAction,
} from "@copilotkit/react-core";
import McpToolCall from "./McpToolCall";

export default function ToolRenderer() {
  useCopilotAction({
    /**
     * The asterisk (*) matches all tool calls
     */
    name: "*",
    render: ({ name, status, args, result }) => (
      <McpToolCall status={status} name={name} args={args} result={result} />
    ),
  });
  return null;
}