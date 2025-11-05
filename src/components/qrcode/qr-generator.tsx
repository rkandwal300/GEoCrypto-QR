
"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import QRCode from "qrcode";
import { encrypt } from "@/lib/crypto";
import {
  DownloadOutlined,
  ShareAltOutlined,
  ReloadOutlined,
  AimOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Typography,
  Space,
  Flex,
  Divider,
} from "antd";
import { createRoot } from 'react-dom/client';
import QrCodeComponent from "qrcode.react";


const { Title, Text } = Typography;

const qrFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(1, { message: "Address is required" }),
});

type QrFormValues = z.infer<typeof qrFormSchema>;

export function QrGenerator() {
  const [qrValue, setQrValue] = useState<string>("");
  const [isShareSupported, setIsShareSupported] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<QrFormValues>({
    resolver: zodResolver(qrFormSchema),
    defaultValues: {
      name: "",
      latitude: undefined,
      longitude: undefined,
      address: "",
    },
  });

  useEffect(() => {
    if (navigator.share) {
      setIsShareSupported(true);
    }
  }, []);

  const onSubmit = (data: QrFormValues) => {
    const payload = {
      ...data,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(payload);
    const encryptedValue = encrypt(jsonString);
    setQrValue(encryptedValue);
    messageApi.success("QR code generated successfully!");
  };

  const handleFetchLocation = () => {
    if (navigator.geolocation) {
      messageApi.loading({ content: "Fetching location...", key: "location" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue("latitude", position.coords.latitude, { shouldValidate: true });
          setValue("longitude", position.coords.longitude, { shouldValidate: true });
          messageApi.success({
            content: "Location coordinates fetched!",
            key: "location",
            duration: 2,
          });
        },
        (error) => {
          messageApi.error({
            content: `Failed to get location: ${error.message}`,
            key: "location",
            duration: 3,
          });
        }
      );
    } else {
      messageApi.error("Geolocation is not supported by your browser.");
    }
  };


  const handleDownload = () => {
    if (!qrValue) {
      messageApi.error("No QR code has been generated.");
      return;
    }

    const canvas = document.createElement('canvas');
    const size = 1024;
    const padding = 40;

    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (!context) {
        messageApi.error("Could not create canvas for download.");
        return;
    }

    // Fill background with white
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, size, size);

    // Generate the QR code directly onto the main canvas with padding
    QRCode.toCanvas(canvas, qrValue, {
        width: size - (padding * 2), // QR code content size
        margin: 0, // We handle padding manually
        errorCorrectionLevel: 'H',
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, (error) => {
        if (error) {
            messageApi.error("Failed to generate QR code for download.");
            console.error(error);
            return;
        }

        // The 'toCanvas' callback gives us the canvas, but it's drawn at the top-left.
        // We need to re-draw it with padding onto another canvas.
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = size;
        finalCanvas.height = size;
        const finalContext = finalCanvas.getContext('2d');

        if (!finalContext) {
            messageApi.error("Could not create final canvas for download.");
            return;
        }

        finalContext.fillStyle = '#FFFFFF';
        finalContext.fillRect(0, 0, size, size);
        finalContext.drawImage(canvas, padding, padding);

        const link = document.createElement("a");
        link.href = finalCanvas.toDataURL("image/png");
        link.download = "geocrypt-qrcode.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        messageApi.success("Download started!");
    });
  };

  const handleShareClick = async () => {
    const canvas =
      qrCodeRef.current?.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas || !navigator.share) {
      messageApi.error(
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
        messageApi.error("Failed to create image from QR code.");
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
         messageApi.error(`Share failed: ${error.message || "Could not share the QR code."}`);
      }
    }
  };

  const handleGenerateAgain = () => {
    setQrValue("");
    reset();
  };

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      {contextHolder}
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
            {qrValue ? 'Share or download your generated QR code.' : 'Fill out the form to generate a location-specific QR code.'}
          </Text>
        </Flex>

        {qrValue ? (
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
                <QrCodeComponent
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
                  onClick={handleGenerateAgain}
                  icon={<ReloadOutlined />}
                  size="large"
                >
                  Generate Again
                </Button>
                <Button
                  onClick={handleDownload}
                  icon={<DownloadOutlined />}
                  size="large"
                  type="primary"
                >
                  Download
                </Button>
                {isShareSupported && (
                  <Button
                    onClick={handleShareClick}
                    icon={<ShareAltOutlined />}
                    size="large"
                    ghost
                    type="primary"
                  >
                    Share
                  </Button>
                )}
              </Space>
            </Flex>
          </div>
        ) : (
          <Form
            layout="vertical"
            onFinish={handleSubmit(onSubmit)}
            style={{ padding: '0 24px 24px' }}
          >
             <Form.Item
              label="Location Name"
              validateStatus={errors.name ? 'error' : ''}
              help={errors.name?.message}
            >
              <Controller
                name="name"
                control={control}
                render={({ field }) => <Input {...field} placeholder="e.g., Central Park" />}
              />
            </Form.Item>
            
            <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
                 <Text type="secondary">Coordinates</Text>
                 <Button
                    icon={<AimOutlined />}
                    onClick={handleFetchLocation}
                    size="small"
                  >
                    Fetch Current Location
                  </Button>
            </Flex>
            
            <Flex gap="middle" align="start">
              <Form.Item
                label="Latitude"
                validateStatus={errors.latitude ? 'error' : ''}
                help={errors.latitude?.message}
                style={{ flex: 1, marginBottom: errors.latitude ? 24 : 8 }}
              >
                <Controller
                  name="latitude"
                  control={control}
                  render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%' }} placeholder="e.g., 40.785091" />
                  )}
                />
              </Form.Item>
              <Form.Item
                label="Longitude"
                validateStatus={errors.longitude ? 'error' : ''}
                help={errors.longitude?.message}
                style={{ flex: 1, marginBottom: errors.longitude ? 24 : 8 }}
              >
                <Controller
                  name="longitude"
                  control={control}
                  render={({ field }) => (
                    <InputNumber {...field} style={{ width: '100%' }} placeholder="e.g., -73.968285" />
                  )}
                />
              </Form.Item>
            </Flex>

            <Form.Item
              label="Address"
              validateStatus={errors.address ? 'error' : ''}
              help={errors.address?.message}
            >
              <Controller
                name="address"
                control={control}
                render={({ field }) => <Input.TextArea {...field} placeholder="e.g., New York, NY 10024, USA" autoSize={{ minRows: 2 }} />}
              />
            </Form.Item>
            
            <Divider />

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" size="large" block>
                Generate QR Code
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
}

