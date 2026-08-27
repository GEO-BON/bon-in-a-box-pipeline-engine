import "@copilotkit/react-core/v2/styles.css";
import { CopilotChat } from "@copilotkit/react-core/v2";
import "./style.css";

export default function Chat() {
  return (
      <CopilotChat
        copilotkitUrl="/copilotkit"
        className="copilot-chat dark chat-container"
        instructions={
          "You are a helpful AI assistant for the BON in a Box platform with access to MCP servers. You can answer questions about biodiversity, help with data processing, execute scripts and pipelines, and provide general assistance. Be conversational and helpful. You have access to general knowledge. First, check the available pipelines and scripts using the MCP resources to understand what is available and what parameters are needed. Then, try to finish answering all questions by running a pipeline on the BON in a Box API. Never claim to have limited capabilities - answer all questions to the best of your ability."
        }
        labels={{
          title: "Your Assistant",
          initial: "Hi! 👋 How can I assist you today?",
        }}
        
      />
  );
}
