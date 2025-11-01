
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';


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
  const [isStarredSheetOpen, setStarredSheetOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredMessages, setStarredMessages] = useState(new Set());
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  const scrollAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageRefs = useRef({});

  const { messages, sendMessage, connected } = useChatSocket({
    userId,
    otherId,
    roomId,
  });

  const filteredMessages = messages.filter((msg) =>
    msg.text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const starredMessagesDetails = Array.from(starredMessages)
    .map((id) => messages.find((msg) => msg.id === id))
    .filter(Boolean);

  // Scroll to the bottom of the message list whenever new messages are added
  useEffect(() => {
    if (scrollAreaRef.current && !searchQuery) {
      const scrollableViewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollableViewport) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    }
  }, [messages, searchQuery]);

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
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // In a real app, you'd upload the file to a server and get a URL.
    // For this mock, we'll just create a local object URL.
    const fileUrl = URL.createObjectURL(file);

    const message = {
      file: {
        url: fileUrl,
        name: file.name,
        size: file.size,
      },
      senderId: userId,
      type: 'file',
    };
    sendMessage(message);
  };

  const toggleStar = (messageId) => {
    const newStarred = new Set(starredMessages);
    if (newStarred.has(messageId)) {
      newStarred.delete(messageId);
    } else {
      newStarred.add(messageId);
    }
    setStarredMessages(newStarred);
  };

  const scrollToMessage = (messageId) => {
    messageRefs.current[messageId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setStarredSheetOpen(false);
  };

  const headerActions = [
    { icon: Phone, tooltip: 'Call', onClick: () => {} },
    { icon: Star, tooltip: 'Starred Messages', onClick: () => setStarredSheetOpen(true) },
    { icon: Search, tooltip: 'Search', onClick: () => setIsSearchVisible(true) },
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
            <div className="relative">
              <Avatar>
                <AvatarFallback>
                  {title.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Badge className={`absolute bottom-0 right-0 w-3 h-3 p-0 border-2 border-background ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div>
              <h3 className="chat-title">{title}</h3>
              <span className="chat-status">
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          
          {isSearchVisible ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsSearchVisible(false);
                  setSearchQuery('');
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="chat-header-actions">
              {headerActions.map((action, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={action.onClick}>
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
          )}
        </header>

        <ScrollArea className="chat-messages-container" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {filteredMessages.map((item) => (
              <div
                key={item.id}
                ref={(el) => (messageRefs.current[item.id] = el)}
                onMouseEnter={() => setHoveredMessageId(item.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className={`chat-message-wrapper ${
                  item.senderId === userId ? 'sent' : 'received'
                }`}
              >
                <div className={`chat-message ${item.senderId === userId ? 'sent' : 'received'}`}>
                  <div className="message-content">
                    {item.type === 'text' && <p>{item.text}</p>}
                    {item.type === 'file' && (
                      <a
                        href={item.file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <Paperclip className="h-4 w-4" /> <span>{item.file.name}</span>
                      </a>
                    )}
                    <div className="message-timestamp">
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <span>
                            {formatDistanceToNow(new Date(item.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {new Date(item.timestamp).toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="star-button h-7 w-7"
                      onClick={() => toggleStar(item.id)}
                    >
                      <Star
                        className={cn('h-4 w-4', starredMessages.has(item.id) && 'fill-current text-yellow-400')}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Star message</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              ))}
          </div>
        </ScrollArea>

        <footer className="chat-footer">
           <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="resize-none max-h-24"
            disabled={!connected}
          />
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            disabled={!connected}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => fileInputRef.current?.click()}
                disabled={!connected}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Attach file</p></TooltipContent>
          </Tooltip>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !connected}
            size="icon"
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </footer>

        <Sheet open={isPeopleSidebarOpen} onOpenChange={setPeopleSidebarOpen}>
          <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col">
            <div className="p-4 border-b">
                <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="Search people..." className="pl-9"/>
                </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-lg px-2">People</h3>
                  {peopleInChat.map((person) => (
                    <div key={person.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                        <Avatar>
                            <AvatarImage src={person.avatar} alt={person.name} />
                            <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{person.name}</span>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <Sheet open={isStarredSheetOpen} onOpenChange={setStarredSheetOpen}>
          <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b text-left">
              <SheetTitle>Starred Messages</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {starredMessagesDetails.length > 0 ? (
                  starredMessagesDetails.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => scrollToMessage(msg.id)}
                      className="block w-full text-left p-3 rounded-md hover:bg-muted"
                    >
                      <p className="font-semibold">{peopleInChat.find(p => p.id === msg.senderId)?.name || msg.senderId}</p>
                      <p className="text-sm text-muted-foreground truncate">{msg.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.timestamp).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <Star className="mx-auto h-8 w-8 mb-2" />
                    <p>No starred messages</p>
                    <p className="text-xs mt-1">Star messages to easily find them later.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
