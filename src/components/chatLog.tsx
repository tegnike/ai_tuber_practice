import { useEffect, useRef } from "react";
import { Message } from "@/features/messages/messages";
type Props = {
  messages: Message[];
};
export const ChatLog = ({ messages }: Props) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: "auto",
      block: "center",
    });
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [messages]);
  return (
    <div className="absolute w-col-span-6 max-w-full h-[100svh] pb-64">
      <div className="max-h-full px-16 pt-104 pb-64 overflow-y-auto scroll-hidden">
        {messages.map((msg, i) => {
          return (
            <div key={i} ref={messages.length - 1 === i ? chatScrollRef : null} className="chat">
              <Chat role={msg.role} message={msg.content} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Chat = ({ role, message }: { role: string; message: string }) => {
  const roleColor =
    role === "assistant" ? "bg-secondary text-white " : "bg-base text-primary";
  const roleText = role === "assistant" ? "text-secondary" : "text-primary";
  const offsetX = role === "user" ? "pr-40" : "pl-40";
  const messageBubble = role === "user" ? "message-bubble-left" : "message-bubble-right";

  const pattern = /\[(neutral|happy|angry|sad|relaxed)\]/g;
  const modifiedMessage = message.replace(pattern, "");

  return (
    <div className={`mx-auto max-w-sm my-16 ${offsetX}`}>
      <div className={`px-8 py-8 rounded-lg ${roleColor} ${messageBubble} relative`}>
        {modifiedMessage}
      </div>
    </div>
  );
};
