
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { List, Avatar, Input, Button, Upload, Badge, Tooltip } from 'antd';
import { PaperClipOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { formatDistanceToNow } from 'date-fns';
import { useChatSocket } from '../../hooks/useChatSocket';
import './ChatWidget.css';

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
      // In a real app, the server would return the file URL.
      // For mock, we'll just pretend it's a path.
      const isMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
      const fileUrl = isMock ? `/uploads/${info.file.name}` : info.file.response.url;

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
    action: process.env.NEXT_PUBLIC_USE_MOCK === 'true'
      ? undefined // No action for mock, we use customRequest
      : `${process.env.NEXT_PUBLIC_API_URL}/upload`,
    customRequest: process.env.NEXT_PUBLIC_USE_MOCK === 'true' ? mockRequest : undefined,
    headers: {
      // Example of how you might pass auth for a real upload endpoint
      // authorization: `Bearer ${your_auth_token}`,
    },
    showUploadList: false, // We display the file in the message list itself
    onChange: handleUploadChange,
  };

  return (
    <div className="chat-widget">
      <header className="chat-header">
        <div className="chat-header-info">
          <Badge
            status={connected ? 'success' : 'error'}
            offset={[-5, 25]}
            dot
          >
            <Avatar icon={<UserOutlined />} />
          </Badge>
          <h3 className="chat-title">{title}</h3>
        </div>
        <span className="chat-status">{connected ? 'Online' : 'Offline'}</span>
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
                  <a href={item.file.url} target="_blank" rel="noopener noreferrer">
                    <PaperClipOutlined /> {item.file.name}
                  </a>
                )}
                <Tooltip title={new Date(item.timestamp).toLocaleString()}>
                  <div className="message-timestamp">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </div>
                </Tooltip>
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
          <Button icon={<PaperClipOutlined />} disabled={!connected} />
        </Upload>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || !connected}
        />
      </footer>
    </div>
  );
}
