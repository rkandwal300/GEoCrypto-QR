'use client';
import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { ChatWidget } from './ChatWidget';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const conversations = [
  {
    userId: 'user2',
    name: 'Alice',
    avatarFallback: 'A',
    lastMessage: "Hey, how's it going?",
    lastMessageTime: '5m',
  },
  {
    userId: 'user3',
    name: 'Bob',
    avatarFallback: 'B',
    lastMessage: 'Can you check the latest designs?',
    lastMessageTime: '2h',
  },
  {
    userId: 'user4',
    name: 'Charlie',
    avatarFallback: 'C',
    lastMessage: 'See you tomorrow!',
    lastMessageTime: '1d',
  },
  {
    userId: 'user5',
    name: 'Diana',
    avatarFallback: 'D',
    lastMessage: 'Thanks for the update.',
    lastMessageTime: '1d',
  },
];

export default function ChatLayout() {
  const [selectedUser, setSelectedUser] = React.useState(conversations[0]);

  return (
    <SidebarProvider defaultOpen>
        <div className="flex h-full w-full flex-row border-t">
            <Sidebar className="h-full max-h-full border-r">
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
                                                <AvatarFallback>{conv.avatarFallback}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col items-start">
                                                <span className="font-medium">{conv.name}</span>
                                                <span className="text-xs text-muted-foreground">
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
            <div className="flex-1">
                <ChatWidget
                    userId="user1"
                    otherId={selectedUser.userId}
                    title={selectedUser.name}
                />
            </div>
        </div>
    </SidebarProvider>
  );
}
