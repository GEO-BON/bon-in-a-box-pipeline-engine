"use client";

import { useCopilotChat } from "@copilotkit/react-core";
import { useEffect } from "react";

function McpServerManager() {
  const { setMcpServers } = useCopilotChat();

  useEffect(() => {
    if(!setMcpServers) return;
    setMcpServers([
      {
        endpoint: "http://localhost:8001/mcp",
      },
    ]);
  }, [setMcpServers]);

  return null;
}

export default McpServerManager;