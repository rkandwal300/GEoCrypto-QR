'use client';
import * as React from 'react';
import {
  MessageSquare,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { ChatWidget } from './ChatWidget';
import { Avatar } from '@/components/ui/avatar';

interface ChatLayoutProps {
  defaultLayout?: number[] | undefined;
}

const conversations = [
  {
    userId: 'user2',
    name: 'Alice',
    avatar: '/avatars/01.png',
    lastMessage: "Hey, how's it going?",
    lastMessageTime: '5m',
  },
  {
    userId: 'user3',
    name: 'Bob',
    avatar: '/avatars/02.png',
    lastMessage: 'Can you check the latest designs?',
    lastMessageTime: '2h',
  },
  {
    userId: 'user4',
    name: 'Charlie',
    avatar: '/avatars/03.png',
    lastMessage: 'See you tomorrow!',
    lastMessageTime: '1d',
  },
  {
    userId: 'user5',
    name: 'Diana',
    avatar: '/avatars/04.png',
    lastMessage: 'Thanks for the update.',
    lastMessageTime: '1d',
  },
];

export default function ChatLayout({ defaultLayout = [320, 1080] }: ChatLayoutProps) {
  const [selectedUser, setSelectedUser] = React.useState(conversations[0]);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarContent className="p-0">
          <SidebarMenu>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center">
                <MessageSquare className="mr-2" />
                Conversations
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {conversations.map((conv) => (
                  <SidebarMenuItem key={conv.userId}>
                    <SidebarMenuButton
                      onClick={() => setSelectedUser(conv)}
                      isActive={selectedUser.userId === conv.userId}
                      className="h-auto p-2"
                    >
                      <Avatar className="h-10 w-10">
                        <Users />
                      </Avatar>
                      <div className="flex flex-col items-start truncate">
                        <span className="font-medium">{conv.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage}
                        </span>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {conv.lastMessageTime}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="p-0 md:p-0">
         <ChatWidget userId="user1" otherId={selectedUser.userId} title={selectedUser.name} />
      </SidebarInset>
    </SidebarProvider>
  );
}
