"use client";

import { useState, useRef, useEffect } from "react";
import QRCode from "qrcode.react";
import {
  DownloadOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  message,
  Typography,
  Space,
  Flex,
} from "antd";

const { Title, Text } = Typography;

export function QrGenerator() {
  const [qrValue] = useState<string>("GeoCrypt-QR-Verification-v1.0.0");
  const [isShareSupported, setIsShareSupported] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // navigator is only available on the client side.
    if (navigator.share) {
      setIsShareSupported(true);
    }
  }, []);

  const handleDownload = () => {
    const originalCanvas =
      qrCodeRef.current?.querySelector<HTMLCanvasElement>("canvas");
    if (!originalCanvas || !qrValue) {
      message.error("Could not find the QR code canvas.");
      return;
    }

    const downloadSize = 1024;
    const padding = downloadSize * 0.1;
    const innerSize = downloadSize - padding * 2;

    const downloadCanvas = document.createElement("canvas");
    downloadCanvas.width = downloadSize;
    downloadCanvas.height = downloadSize;
    const ctx = downloadCanvas.getContext("2d");

    if (!ctx) {
      message.error("Could not create a canvas for downloading.");
      return;
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, downloadSize, downloadSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(originalCanvas, padding, padding, innerSize, innerSize);

    const link = document.createElement("a");
    link.href = downloadCanvas.toDataURL("image/png");
    link.download = "geocrypt-qrcode.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success("Download started!");
  };

  const handleShareClick = async () => {
    const canvas =
      qrCodeRef.current?.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas || !navigator.share) {
      message.error(
        !canvas
          ? "QR code not found."
          : "Web Share API is not supported on this browser."
      );
      return;
    }

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        message.error("Failed to create image from QR code.");
        return;
      }
      const file = new File([blob], "geocrypt-qrcode.png", {
        type: "image/png",
      });
      
      await navigator.share({
        files: [file],
      });

    } catch (error: any) {
      if (error.name !== "AbortError") {
         message.error(`Share failed: ${error.message || "Could not share the QR code."}`);
      }
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <Card
        style={{
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #f0f0f0',
        }}
      >
        <Flex vertical align="center" gap="middle" style={{ padding: '24px' }}>
          <Title level={2} style={{ marginTop: 0, textAlign: 'center' }}>
            Location Verification QR Code
          </Title>
          <Text type="secondary" style={{ textAlign: 'center' }}>
            Scan this QR code on-site to verify your location.
          </Text>
        </Flex>

        {qrValue && (
          <div style={{ padding: '24px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
            <Flex vertical align="center" gap="large">
              <div
                ref={qrCodeRef}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.09)',
                }}
                aria-label="Generated QR Code"
              >
                <QRCode
                  value={qrValue}
                  size={256}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  renderAs="canvas"
                />
              </div>
              <Space wrap style={{ justifyContent: 'center' }}>
                <Button
                  onClick={handleDownload}
                  icon={<DownloadOutlined />}
                  size="large"
                >
                  Download
                </Button>
                {isShareSupported && (
                  <Button
                    onClick={handleShareClick}
                    icon={<ShareAltOutlined />}
                    size="large"
                    type="primary"
                    ghost
                  >
                    Share
                  </Button>
                )}
              </Space>
            </Flex>
          </div>
        )}
      </Card>
    </div>
  );
}
