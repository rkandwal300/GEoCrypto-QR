"use client";

import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import QRCode from "qrcode.react";
import {
  DownloadOutlined,
  ShareAltOutlined,
  ExperimentOutlined,
  EnvironmentOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Typography,
  Space,
  Tooltip,
  Flex,
} from "antd";
import { encryptData } from "@/lib/crypto";

const { Title, Text } = Typography;
const { TextArea } = Input;

const formSchema = z.object({
  jsonData: z.string().min(1, "Input data cannot be empty."),
});

export function QrGenerator() {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonData: "",
    },
  });

  const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue("jsonData", e.target.value, { shouldValidate: true });
    if (qrValue) {
      setQrValue(null);
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setIsGenerating(true);
    setQrValue(null);
    message.loading({
      content: "Getting Location...",
      key: "loc",
      duration: 0,
    });

    if (!navigator.geolocation) {
      message.error(
        "Your browser does not support geolocation."
      );
      setIsGenerating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const dataToEncrypt = {
            data: values.jsonData,
            location: {
              lat: latitude,
              long: longitude,
            },
          };

          const encrypted = encryptData(dataToEncrypt);
          setQrValue(encrypted);
          message.success({
            content: "Your secure, location-aware QR code has been generated.",
            key: "loc",
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unknown error occurred.";
          message.error(`Generation Failed: ${errorMessage}`);
        } finally {
          setIsGenerating(false);
          message.destroy("loc");
        }
      },
      (error) => {
        let description =
          "Could not fetch location. Please enable location services.";
        if (error.code === error.PERMISSION_DENIED) {
          description =
            "Location access was denied. You must allow location access in your browser settings to generate a geo-fenced QR code.";
        }
        message.error(`Location Error: ${description}`);
        setIsGenerating(false);
        message.destroy("loc");
      },
      { enableHighAccuracy: true }
    );
  };

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
          <div
            style={{
              backgroundColor: 'rgba(24, 144, 255, 0.1)',
              padding: '12px',
              borderRadius: '50%',
            }}
          >
            <EnvironmentOutlined
              style={{ fontSize: '32px', color: '#1890ff' }}
            />
          </div>
          <Title level={2} style={{ marginTop: 0, textAlign: 'center' }}>
            Generate Geo-Locked QR Code
          </Title>
          <Text type="secondary" style={{ textAlign: 'center' }}>
            Encrypt data into a QR code that can only be scanned at your
            current location.
          </Text>
        </Flex>

        <div style={{ padding: '0 24px 24px' }}>
          <Form onFinish={handleSubmit(onSubmit)} layout="vertical">
            <Form.Item
              label="Data Payload"
              validateStatus={errors.jsonData ? "error" : ""}
              help={errors.jsonData?.message}
            >
              <Controller
                name="jsonData"
                control={control}
                render={({ field }) => (
                  <TextArea
                    {...field}
                    placeholder="Enter any text or data you want to encrypt..."
                    rows={6}
                    onChange={handleDataChange}
                    style={{ fontFamily: "monospace" }}
                  />
                )}
              />
               <Text type="secondary" style={{ textAlign: 'center', display: 'block', marginTop: 8 }}>
                Your current location will be embedded and encrypted into the QR code.
              </Text>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={isGenerating}
                icon={
                  isGenerating ? <LoadingOutlined /> : <ExperimentOutlined />
                }
              >
                {isGenerating ? "Generating..." : "Generate Code"}
              </Button>
            </Form.Item>
          </Form>
        </div>

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
                {navigator.share && (
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
