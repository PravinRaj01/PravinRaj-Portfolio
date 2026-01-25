import { useState } from "react";
import ChatbotButton from "./ChatbotButton";
import ChatbotDrawer, { ChatbotState } from "./ChatbotDrawer";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const PortfolioChatbot = () => {
  const [state, setState] = useState<ChatbotState>("closed");
  const { data: siteSettings } = useSiteSettings();

  // Check if chatbot is enabled (default to true if not set)
  const isChatbotEnabled = siteSettings?.chatbot_enabled !== false;

  const handleToggle = () => {
    setState((prev) => {
      if (prev === "closed") return "mini";
      return "closed";
    });
  };

  const handleStateChange = (newState: ChatbotState) => {
    setState(newState);
  };

  // Don't render if chatbot is disabled
  if (!isChatbotEnabled) {
    return null;
  }

  return (
    <>
      <ChatbotButton onClick={handleToggle} state={state === "closed" ? "closed" : "open"} />
      <ChatbotDrawer state={state} onStateChange={handleStateChange} />
    </>
  );
};

export default PortfolioChatbot;
