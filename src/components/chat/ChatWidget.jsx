'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  PaperClipOutlined,
  SendOutlined,
  StarOutlined,
  StarFilled,
  SearchOutlined,
  TeamOutlined,
  CloseOutlined,
  SmileOutlined,
  MoreOutlined,
  EnvironmentOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import {
  Layout,
  Input,
  Button,
  Avatar,
  Typography,
  List,
  Tooltip,
  Dropdown,
  Popover,
  Flex,
  Space,
  Drawer,
  Collapse,
  Badge,
  Divider,
  message,
} from 'antd';
import { formatDistanceToNow } from 'date-fns';
import { useChatSocket } from '../../hooks/useChatSocket';
import Picker from 'emoji-picker-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

/**
 * A reusable chat UI component for real-time messaging using Ant Design.
 * @param {object} props - The component props.
 * @param {string} props.userId - The ID of the current user.
 * @param {string} props.otherId - The ID of the other user in the chat.
 * @param {string} [props.roomId] - The explicit room ID, if available.
 * @param {string} [props.title='Chat'] - The title to display in the chat header.
 */
export function ChatWidget({ userId, otherId, roomId, title = 'trip-123' }) {
  const [inputValue, setInputValue] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredMessages, setStarredMessages] = useState(new Set());
  const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const scrollAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageRefs = useRef({});

  const { messages, sendMessage, connected } = useChatSocket({
    userId,
    otherId,
    roomId,
  });

  const filteredMessages = messages.filter(
    (msg) =>
      msg.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.type === 'location' ||
      msg.type === 'file'
  );

  const starredMessagesDetails = Array.from(starredMessages)
    .map((id) => messages.find((msg) => msg.id === id))
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const peopleInChat = [
    { id: 'user1', name: 'You', avatar: 'https://i.pravatar.cc/150?u=user1' },
    { id: 'user2', name: 'Alice', avatar: 'https://i.pravatar.cc/150?u=user2' },
    { id: 'user3', name: 'Bob', avatar: 'https://i.pravatar.cc/150?u=user3' },
  ];

  useEffect(() => {
    if (scrollAreaRef.current && !searchQuery) {
      const scrollableViewport = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollableViewport) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    }
  }, [messages, searchQuery]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const message = {
        text: inputValue,
        senderId: userId,
        type: 'text',
      };
      sendMessage(message);
      setInputValue('');
      setEmojiPickerOpen(false);
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setInputValue((prev) => prev + emojiObject.emoji);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const fileUrl = URL.createObjectURL(file);
    const message = {
      file: { url: fileUrl, name: file.name, size: file.size },
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
    setSidebarOpen(false);
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation is not supported by your browser.');
      return;
    }

    message.loading({ content: 'Getting your location...', key: 'location' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationMessage = {
          type: 'location',
          senderId: userId,
          location: {
            lat: latitude,
            long: longitude,
          },
        };
        sendMessage(locationMessage);
        message.success({ content: 'Location sent!', key: 'location', duration: 2 });
      },
      (error) => {
        message.error({ content: `Failed to get location: ${error.message}`, key: 'location', duration: 3 });
      }
    );
  };

  const moreOptionsMenu = {
    items: [
      {
        key: 'location',
        icon: <EnvironmentOutlined />,
        label: 'Send current location',
        onClick: handleSendLocation,
      },
    ],
  };

  const sidebarItems = [
    {
      key: '1',
      label: 'Starred Messages',
      children:
        starredMessagesDetails.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={starredMessagesDetails}
            renderItem={(item) => (
              <List.Item
                onClick={() => scrollToMessage(item.id)}
                style={{ cursor: 'pointer', padding: '8px 16px' }}
              >
                <List.Item.Meta
                  title={
                    peopleInChat.find((p) => p.id === item.senderId)?.name ||
                    item.senderId
                  }
                  description={<Text ellipsis>{item.text}</Text>}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {new Date(item.timestamp).toLocaleDateString()}
                </Text>
              </List.Item>
            )}
          />
        ) : (
          <Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', padding: '20px' }}
          >
            No starred messages found
          </Text>
        ),
    },
    {
      key: '2',
      label: 'People',
      children: (
        <List
          dataSource={peopleInChat}
          renderItem={(person) => (
            <List.Item style={{ padding: '8px 16px' }}>
              <List.Item.Meta
                avatar={<Avatar src={person.avatar} />}
                title={person.name}
              />
            </List.Item>
          )}
        />
      ),
    },
  ];

  const sidebarContent = (
    <>
      <Drawer
        title={<div className="sr-only">Details</div>}
        placement="right"
        onClose={() => setSidebarOpen(false)}
        open={isSidebarOpen}
        width={350}
        styles={{ header: { display: 'none' }, body: { padding: 0 } }}
      >
        <Flex
          align="center"
          justify="space-between"
          style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}
        >
          <Input
            placeholder="Search messages..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            icon={<CloseOutlined />}
            type="text"
            onClick={() => setSidebarOpen(false)}
          />
        </Flex>
        <Collapse items={sidebarItems} defaultActiveKey={['1', '2']} ghost />
      </Drawer>
    </>
  );

  const renderMessageContent = (item) => {
    switch (item.type) {
      case 'text':
        return <p style={{ margin: 0 }}>{item.text}</p>;
      case 'file':
        return (
          <a
            href={item.file.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit' }}
          >
            <PaperClipOutlined /> {item.file.name}
          </a>
        );
      case 'location':
        if (item.location) {
          return (
             <div style={{width: 250, display: 'flex', flexDirection: 'column', gap: 8}}>
                 <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <PushpinOutlined />
                    <span style={{fontWeight: 500}}>Location Shared</span>
                 </div>
                <div style={{aspectRatio: '16/9', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid hsl(var(--border))'}}>
                <iframe
                    width="100%"
                    height="100%"
                    loading="lazy"
                    allowFullScreen
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${item.location.long - 0.01}%2C${item.location.lat - 0.01}%2C${item.location.long + 0.01}%2C${item.location.lat + 0.01}&layer=mapnik&marker=${item.location.lat}%2C${item.location.long}`}
                  ></iframe>
                </div>
             </div>
          );
        }
        return 'Location data is missing.';
      default:
        return null;
    }
  }

  return (
    <Layout style={{ height: '100%', background: 'hsl(var(--background))' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))',
          height: '64px',
        }}
      >
        <Flex align="center" gap="middle">
          <Badge dot color={connected ? 'green' : 'red'} offset={[-8, 32]}>
            <Avatar size="large">{title.charAt(0)}</Avatar>
          </Badge>
          <Flex vertical>
            <Title level={5} style={{ margin: 0 }}>
              {title}
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>{connected ? 'Online' : 'Offline'}</Text>
          </Flex>
        </Flex>

        {isSearchVisible ? (
          <Flex align="center" gap="small">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '200px' }}
            />
            <Button
              icon={<CloseOutlined />}
              onClick={() => {
                setIsSearchVisible(false);
                setSearchQuery('');
              }}
            />
          </Flex>
        ) : (
          <Space>
            <Tooltip title="Starred Messages">
               <Button
                shape="circle"
                icon={<StarOutlined />}
                onClick={() => setSidebarOpen(true)}
              />
            </Tooltip>
            <Tooltip title="Search">
              <Button
                shape="circle"
                icon={<SearchOutlined />}
                onClick={() => setIsSearchVisible(true)}
              />
            </Tooltip>
            <Divider type="vertical" style={{ height: '24px' }} />
            <Tooltip title="People">
              <Button
                shape="circle"
                icon={<TeamOutlined />}
                onClick={() => setSidebarOpen(true)}
              />
            </Tooltip>
          </Space>
        )}
      </Header>
      <Content style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea
          className="chat-messages-container h-full"
          ref={scrollAreaRef}
        >
          <List
            split={false}
            dataSource={filteredMessages}
            renderItem={(item) => {
              const isSent = item.senderId === userId;
              return (
                <List.Item
                  ref={(el) => (messageRefs.current[item.id] = el)}
                  style={{
                    display: 'flex',
                    justifyContent: isSent ? 'flex-end' : 'flex-start',
                    padding: '0 16px 8px',
                    border: 'none',
                  }}
                >
                  <div
                    className="message-content-wrapper"
                    style={{ maxWidth: '75%' }}
                  >
                    <Flex gap="small" align="flex-end">
                      {!isSent && <Avatar size="small" />}
                      <div
                        className="message-bubble"
                        style={{
                          background: isSent
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted))',
                          color: isSent
                            ? 'hsl(var(--primary-foreground))'
                            : 'hsl(var(--foreground))',
                          padding: '8px 12px',
                          borderRadius: '18px',
                          borderBottomLeftRadius: isSent ? '18px' : '4px',
                          borderBottomRightRadius: isSent ? '4px' : '18px',
                        }}
                      >
                       {renderMessageContent(item)}
                        <Flex
                          justify="flex-end"
                          align="center"
                          gap={4}
                          style={{ marginTop: '4px' }}
                        >
                          <Tooltip
                            title={new Date(item.timestamp).toLocaleString()}
                          >
                            <Text
                              style={{
                                fontSize: '10px',
                                color: isSent
                                  ? 'hsla(var(--primary-foreground), 0.7)'
                                  : 'hsl(var(--muted-foreground))',
                              }}
                            >
                              {formatDistanceToNow(new Date(item.timestamp), {
                                addSuffix: true,
                              })}
                            </Text>
                          </Tooltip>
                          <Tooltip title="Star message">
                            <Button
                              type="text"
                              size="small"
                              shape="circle"
                              icon={
                                starredMessages.has(item.id) ? (
                                  <StarFilled style={{ color: '#ffc107' }} />
                                ) : (
                                  <StarOutlined />
                                )
                              }
                              onClick={() => toggleStar(item.id)}
                              style={{
                                color: isSent
                                  ? 'hsla(var(--primary-foreground), 0.7)'
                                  : 'hsl(var(--muted-foreground))',
                              }}
                            />
                          </Tooltip>
                        </Flex>
                      </div>
                    </Flex>
                  </div>
                </List.Item>
              );
            }}
          />
        </ScrollArea>
      </Content>
      <Footer
        style={{
          padding: '12px 16px',
          borderTop: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))',
        }}
      >
        <Flex align="center" gap="small">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Send a message..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={!connected}
            autoFocus
            style={{
              flex: 1,
              background: 'hsl(var(--muted))',
              border: 'none',
              boxShadow: 'none',
            }}
          />
          <Space>
             <Popover
                content={<Picker onEmojiClick={handleEmojiClick} />}
                trigger="click"
                open={isEmojiPickerOpen}
                onOpenChange={setEmojiPickerOpen}
                placement="topLeft"
              >
              <Button shape="circle" icon={<SmileOutlined />} />
            </Popover>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={!connected}
            />
            <Button
              shape="circle"
              icon={<PaperClipOutlined />}
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected}
            />
            <Dropdown menu={moreOptionsMenu} placement="topRight" trigger={['click']}>
              <Button shape="circle" icon={<MoreOutlined />} />
            </Dropdown>
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !connected}
            />
          </Space>
        </Flex>
      </Footer>

      {sidebarContent}
    </Layout>
  );
}
