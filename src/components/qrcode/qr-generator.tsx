
"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import QRCode from "qrcode.react";
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
import ReactDOM from 'react-dom';


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
    message.success("QR code generated successfully!");
  };

  const handleFetchLocation = () => {
    if (navigator.geolocation) {
      message.loading({ content: "Fetching location...", key: "location" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue("latitude", position.coords.latitude, { shouldValidate: true });
          setValue("longitude", position.coords.longitude, { shouldValidate: true });
          message.success({
            content: "Location coordinates fetched!",
            key: "location",
            duration: 2,
          });
        },
        (error) => {
          message.error({
            content: `Failed to get location: ${error.message}`,
            key: "location",
            duration: 3,
          });
        }
      );
    } else {
      message.error("Geolocation is not supported by your browser.");
    }
  };


  const handleDownload = () => {
    if (!qrValue) {
      message.error("No QR code has been generated.");
      return;
    }

    const downloadSize = 1024;
    const padding = 40;
    const innerQrSize = downloadSize - padding * 2;

    // Create a temporary div to render the high-res QR code off-screen
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);

    // Render the high-res QR code into the temporary div
    const tempQrComponent = (
      <QRCode
        value={qrValue}
        size={innerQrSize}
        level="H"
        renderAs="canvas"
        bgColor="#FFFFFF"
        fgColor="#000000"
      />
    );
    ReactDOM.render(tempQrComponent, tempDiv);

    // Find the canvas element that was just rendered
    const qrCanvas = tempDiv.querySelector("canvas");
    if (!qrCanvas) {
      message.error("Could not generate QR code for download.");
      document.body.removeChild(tempDiv);
      return;
    }

    // Create the final download canvas with padding
    const downloadCanvas = document.createElement("canvas");
    const ctx = downloadCanvas.getContext("2d");
    if (!ctx) {
      message.error("Could not create canvas for download.");
      document.body.removeChild(tempDiv);
      return;
    }

    downloadCanvas.width = downloadSize;
    downloadCanvas.height = downloadSize;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, downloadSize, downloadSize);

    // Draw the high-resolution QR code onto the padded canvas
    ctx.drawImage(qrCanvas, padding, padding);

    // Trigger the download
    const link = document.createElement("a");
    link.href = downloadCanvas.toDataURL("image/png");
    link.download = "geocrypt-qrcode.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the temporary div
    ReactDOM.unmountComponentAtNode(tempDiv);
    document.body.removeChild(tempDiv);

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

  const handleGenerateAgain = () => {
    setQrValue("");
    reset();
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
