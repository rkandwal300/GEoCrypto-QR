import { QrGenerator } from "@/components/qr-generator";
import { ChatWidget } from "@/components/chat/ChatWidget";

export default function GeneratePage() {
  return <ChatWidget userId="user1" otherId="user2" title="Support Chat" />;
  // return <QrGenerator />;
}
