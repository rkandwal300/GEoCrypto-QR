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
  MenuProps,
  CollapseProps,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useChatSocket } from '../../hooks/useChatSocket';
import Picker, { EmojiClickData } from 'emoji-picker-react';

dayjs.extend(relativeTime);

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

interface Location {
  lat: number;
  long: number;
}

interface FileData {
  url: string;
  name: string;
  size: number;
}

interface Message {
  id: string;
  senderId: string;
  type: 'text' | 'file' | 'location';
  timestamp: string;
  text?: string;
  file?: FileData;
  location?: Location;
  name?: string; // Add name property
}

interface ChatWidgetProps {
  userId: string;
  otherId: string;
  roomId?: string;
  title?: string;
}

/**
 * A reusable chat UI component for real-time messaging using Ant Design.
 * @param {object} props - The component props.
 * @param {string} props.userId - The ID of the current user.
 * @param {string} props.otherId - The ID of the other user in the chat.
 * @param {string} [props.roomId] - The explicit room ID, if available.
 * @param {string} [props.title='trip-123'] - The title to display in the chat header.
 */
export function ChatWidget({ userId, otherId, roomId, title = 'trip-123' }: ChatWidgetProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [starredMessages, setStarredMessages] = useState<Set<string>>(new Set());
  const [isEmojiPickerOpen, setEmojiPickerOpen] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const { messages, sendMessage, connected } = useChatSocket({
    userId,
    otherId,
    roomId,
  });

  const filteredMessages: Message[] = messages.filter(
    (msg: Message) =>
      msg.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.type === 'location' ||
      msg.type === 'file'
  );

  const starredMessagesDetails = Array.from(starredMessages)
    .map((id) => messages.find((msg: Message) => msg.id === id))
    .filter((msg): msg is Message => !!msg)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const peopleInChat = [
    { id: 'user1', name: 'You', avatar: 'https://i.pravatar.cc/150?u=user1' },
    { id: 'user2', name: 'Alice', avatar: 'https://i.pravatar.cc/150?u=user2' },
    { id: 'user3', name: 'Bob', avatar: 'https://i.pravatar.cc/150?u=user3' },
  ];

  useEffect(() => {
    if (contentRef.current && !searchQuery) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages, searchQuery]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const message = {
        text: inputValue,
        senderId: userId,
        type: 'text' as const,
      };
      sendMessage(message);
      setInputValue('');
      setEmojiPickerOpen(false);
    }
  };

  const handleEmojiClick = (emojiObject: EmojiClickData) => {
    setInputValue((prev) => prev + emojiObject.emoji);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileUrl = URL.createObjectURL(file);
    const message = {
      file: { url: fileUrl, name: file.name, size: file.size },
      senderId: userId,
      type: 'file' as const,
    };
    sendMessage(message);
  };

  const toggleStar = (messageId: string) => {
    const newStarred = new Set(starredMessages);
    if (newStarred.has(messageId)) {
      newStarred.delete(messageId);
    } else {
      newStarred.add(messageId);
    }
    setStarredMessages(newStarred);
  };

  const scrollToMessage = (messageId: string) => {
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
          type: 'location' as const,
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

  const moreOptionsMenu: MenuProps = {
    items: [
      {
        key: 'location',
        icon: <EnvironmentOutlined />,
        label: 'Send current location',
        onClick: handleSendLocation,
      },
    ],
  };

  const sidebarItems: CollapseProps['items'] = [
    {
      key: '1',
      label: <Typography.Text strong>Starred Messages</Typography.Text>,
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
                    <Typography.Text strong>
                      {peopleInChat.find((p) => p.id === item.senderId)?.name || item.senderId}
                    </Typography.Text>
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
      label: <Typography.Text strong>People</Typography.Text>,
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

  const renderMessageContent = (item: Message, isSent: boolean) => {
    switch (item.type) {
      case 'text':
        return <p style={{ margin: 0, color: isSent ? '#fff' : 'inherit' }}>{item.text}</p>;
      case 'file':
        if (item.file) {
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
        }
        return 'File data is missing.';
      case 'location':
        if (item.location) {
          return (
            <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PushpinOutlined />
                <span style={{ fontWeight: 500 }}>Location Shared</span>
              </div>
              <div style={{ aspectRatio: '16/9', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
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
    <Layout style={{ height: '100%', background: '#fff' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#ffffff',
          height: '64px',
        }}
      >
        <Flex align="center" gap="middle">
          <Badge dot color={connected ? 'green' : 'red'} offset={[-10, 32]}>
            <Avatar size="large" style={{ background: '#1890ff' }}>
              {title.charAt(0).toUpperCase()}
            </Avatar>
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
      <Content style={{ flex: 1, overflow: 'auto', padding: '16px 0', background: '#f5f5f5' }} ref={contentRef}>
        <List
          split={false}
          dataSource={filteredMessages}
          renderItem={(item) => {
            const isSent = item.senderId === userId;
            const isText = item.type === 'text';

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
                    {!isSent && item.name && <Avatar size="small"  >
                      {item.name.charAt(0).toUpperCase()}
                    </Avatar>}
                    <div
                      className="message-bubble"
                      style={{
                        background: isSent ? (isText ? '#1890ff' : '#ffffff') : '#e8e8e8',
                        padding: '8px 12px',
                        borderRadius: '18px',
                        borderBottomLeftRadius: isSent ? '18px' : '4px',
                        borderBottomRightRadius: isSent ? '4px' : '18px',
                        color: isSent ? (isText ? '#ffffff' : '#000000') : '#000000',
                        border: isSent && !isText ? '1px solid #e0e0e0' : 'none',
                      }}
                    >
                      {renderMessageContent(item, isSent)}
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
                              color: isSent && isText ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'
                            }}
                          >
                            {dayjs(item.timestamp).fromNow()}
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
                                <StarOutlined style={{ color: isSent && isText ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)' }} />
                              )
                            }
                            onClick={() => toggleStar(item.id)}
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
      </Content>
      <Footer
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          background: '#ffffff',
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
              border: 'none',
              boxShadow: 'none',
              background: 'transparent',
              resize: 'none'
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
