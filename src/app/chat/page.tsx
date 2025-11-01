import { ChatWidget } from "@/components/chat/ChatWidget";

export default function ChatPage() {
  return (
    <div className="flex-1 h-[calc(100vh-4rem-1px)]">
      <ChatWidget userId="user1" otherId="user2" title="Trip-123" />
    </div>
  );
}
