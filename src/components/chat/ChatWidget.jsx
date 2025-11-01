
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { List, Avatar, Input, Button, Upload, Badge } from 'antd';
import {
  Paperclip,
  Send,
  User,
  Phone,
  Star,
  Search,
  Users,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useChatSocket } from '../../hooks/useChatSocket';
import './ChatWidget.css';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '../ui/separator';

// Mock function for file uploads when using mock server
const mockRequest = ({ onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 1000);
};

/**
 * A reusable chat UI component for real-time messaging.
 * @param {object} props - The component props.
 * @param {string} props.userId - The ID of the current user.
 * @param {string} props.otherId - The ID of the other user in the chat.
 * @param {string} [props.roomId] - The explicit room ID, if available.
 * @param {string} [props.title='Chat'] - The title to display in the chat header.
 */
export function ChatWidget({ userId, otherId, roomId, title = 'Chat' }) {
  const [inputValue, setInputValue] = useState('');
  const [isPeopleSidebarOpen, setPeopleSidebarOpen] = useState(false);
  const listRef = useRef(null);

  const { messages, sendMessage, connected } = useChatSocket({
    userId,
    otherId,
    roomId,
  });

  // Scroll to the bottom of the message list whenever new messages are added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Handler for sending a text message
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const message = {
        text: inputValue,
        senderId: userId,
        type: 'text',
      };
      sendMessage(message);
      setInputValue('');
    }
  };

  // Handler for file uploads
  const handleUploadChange = (info) => {
    if (info.file.status === 'done') {
      const isMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
      const fileUrl = isMock
        ? `/uploads/${info.file.name}`
        : info.file.response.url;

      const message = {
        file: {
          url: fileUrl,
          name: info.file.name,
          size: info.file.size,
        },
        senderId: userId,
        type: 'file',
      };
      sendMessage(message);
    } else if (info.file.status === 'error') {
      console.error('Upload error:', info.file.error);
    }
  };

  const uploadProps = {
    name: 'file',
    action:
      process.env.NEXT_PUBLIC_USE_MOCK === 'true'
        ? undefined
        : `${process.env.NEXT_PUBLIC_API_URL}/upload`,
    customRequest:
      process.env.NEXT_PUBLIC_USE_MOCK === 'true' ? mockRequest : undefined,
    headers: {},
    showUploadList: false,
    onChange: handleUploadChange,
  };
  
  const headerActions = [
    { icon: Phone, tooltip: 'Call' },
    { icon: Star, tooltip: 'Starred Messages' },
    { icon: Search, tooltip: 'Search' },
  ];
  
  const peopleInChat = [
    { id: 'user1', name: 'You', avatar: 'https://i.pravatar.cc/150?u=user1' },
    { id: 'user2', name: 'Alice', avatar: 'https://i.pravatar.cc/150?u=user2' },
    { id: 'user3', name: 'Bob', avatar: 'https://i.pravatar.cc/150?u=user3' },
  ];


  return (
    <TooltipProvider>
      <div className="chat-widget">
        <header className="chat-header">
          <div className="chat-header-info">
            <Badge status={connected ? 'success' : 'error'} offset={[-5, 25]} dot>
              <Avatar icon={<User />} />
            </Badge>
            <div>
              <h3 className="chat-title">{title}</h3>
              <span className="chat-status">
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="chat-header-actions">
            {headerActions.map((action, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <action.icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
             <Separator orientation="vertical" className="h-6 mx-2" />
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPeopleSidebarOpen(true)}>
                        <Users className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>People</p>
                </TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="chat-messages-container" ref={listRef}>
          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                className={`chat-message ${
                  item.senderId === userId ? 'sent' : 'received'
                }`}
              >
                <div className="message-content">
                  {item.type === 'text' && <p>{item.text}</p>}
                  {item.type === 'file' && (
                    <a
                      href={item.file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Paperclip /> {item.file.name}
                    </a>
                  )}
                  <div className="message-timestamp">
                    <Tooltip title={new Date(item.timestamp).toLocaleString()}>
                      <span>
                        {formatDistanceToNow(new Date(item.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </Tooltip>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>

        <footer className="chat-footer">
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={!connected}
          />
          <Upload {...uploadProps} disabled={!connected}>
            <Button icon={<Paperclip />} disabled={!connected} />
          </Upload>
          <Button
            type="primary"
            icon={<Send />}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !connected}
          />
        </footer>

        <Sheet open={isPeopleSidebarOpen} onOpenChange={setPeopleSidebarOpen}>
          <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col">
            <div className="p-4 border-b">
                <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="Search messages..." className="pl-9"/>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <h3 className="font-semibold text-lg">People</h3>
                 <List
                    dataSource={peopleInChat}
                    renderItem={(person) => (
                        <List.Item className='border-none p-0'>
                            <div className="flex items-center gap-3 py-2">
                                <Avatar src={person.avatar}><span className="font-bold">P</span></Avatar>
                                <span className="font-medium">{person.name}</span>
                            </div>
                        </List.Item>
                    )}
                 />

            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
