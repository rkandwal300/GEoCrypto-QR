"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { decrypt } from "@/lib/crypto";
import { LocationVerifier, TargetLocation } from "./LocationVerifier";
// import {   Button,message, Typography, Alert, Flex, Spin } from "antd";
import {  message, Typography, Alert, Flex, Spin } from "antd";
import {
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
// import { Button } from "@/components/button/Button";

const { Title, Text, Paragraph } = Typography;

const QR_READER_ID = "qr-reader";

export function QrScanner() {
  const [targetLocation, setTargetLocation] = useState<TargetLocation | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<string>("idle"); // idle, scanning, success
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!html5QrcodeRef.current) {
      html5QrcodeRef.current = new Html5Qrcode(QR_READER_ID, {
        verbose: false,
      });
    }

    return () => {
      stopScan();
    };
  }, []);

  const stopScan = async () => {
    if (html5QrcodeRef.current?.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (e) {
        console.warn("QR scanner stop failed", e);
      }
    }
    setScannerState("idle");
  };

  const processDecodedText = (decodedText: string) => {
    stopScan();
    try {
      const decrypted = decrypt(decodedText);
      if (!decrypted) {
        throw new Error(
          "Decryption failed. This might be because the QR code is invalid, from a different system, or the encryption key has changed."
        );
      }

      const parsed = JSON.parse(decrypted);

      if (
        !parsed.latitude ||
        !parsed.longitude ||
        !parsed.name ||
        !parsed.address
      ) {
        throw new Error("QR code is missing required location data.");
      }

      setTargetLocation({
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        name: parsed.name,
        address: parsed.address,
      });
      setScannerState("success");
      message.success("QR Code Scanned Successfully!");
    } catch (e: any) {
      setError(
        e.message ||
        "Failed to parse QR code. Please scan a valid GeoCrypt QR code."
      );
      setScannerState("idle");
      message.error(
        "Failed to parse QR code. Please ensure it is a valid code."
      );
    }
  };

  const startCameraScan = async () => {
    setError(null);
    setScannerState("scanning");

    if (!html5QrcodeRef.current) return;
    if (html5QrcodeRef.current.isScanning) {
      await stopScan();
    }

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error("No cameras found on this device.");
      }

      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        processDecodedText,
        undefined
      );
    } catch (err: any) {
      console.error("Camera scan failed", err);
      let errorMessage = "Failed to start camera. Check browser permissions.";
      if (err.name === "NotAllowedError") {
        errorMessage =
          "Camera access was denied. Please enable it in your browser settings.";
      }
      setError(errorMessage);
      setScannerState("idle");
    }
  };

  const handleFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    setError(null);
    setScannerState("scanning");
    try {
      if (html5QrcodeRef.current?.isScanning) {
        await stopScan();
      }
      if (!html5QrcodeRef.current) return;

      const decodedText = await html5QrcodeRef.current.scanFile(file, true);
      processDecodedText(decodedText);
    } catch (err: any) {
      console.error("File scan failed", err);
      let friendlyError =
        "Could not scan the QR code from the image. Please try another image.";
      if (
        typeof err === "string" &&
        err.includes("No MultiFormat Readers were able to detect the code")
      ) {
        friendlyError =
          "Could not detect a QR code in the uploaded image. Please ensure the image is clear, well-lit, and the QR code is fully visible.";
      } else if (err.message) {
        friendlyError = err.message;
      }
      setError(friendlyError);
      setScannerState("idle");
    }
  };

  const handleScanAgain = () => {
    setTargetLocation(null);
    setError(null);
    setScannerState("idle");
  };

  if (targetLocation) {
    return (
      <LocationVerifier
        targetLocation={targetLocation}
        onScanAgain={handleScanAgain}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "800px",
        margin: "16px auto",
        padding: "16px",
      }}
    >
      <Flex vertical align="center" gap="middle" style={{ padding: "24px" }}>
        <Title level={2} style={{ textAlign: "center", margin: 0 }}>
          Report your arrival
        </Title>
        <Paragraph
          type="secondary"
          style={{ textAlign: "center", fontSize: 16 }}
        >
          please scan the QR code at the gate. We’ll use your location to
          confirm you’re at the correct site.
        </Paragraph>
      </Flex>

      <div style={{ padding: "0 24px 24px" }}>
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <div
          id={QR_READER_ID}
          style={{
            width: "100%",
            display: scannerState === "scanning" ? "block" : "none",
          }}
        ></div>

        {scannerState === "scanning" && (
          <Flex
            justify="center"
            align="center"
            vertical
            gap="small"
            style={{ marginTop: 16 }}
          >
            <Spin />
            <Text type="secondary">Waiting for QR Code...</Text>
            <Button onClick={stopScan} danger>
              Cancel
            </Button>
          </Flex>
        )}

        {scannerState === "idle" && (
          <Flex vertical gap="middle">
            <Button
              type="primary"
              size="middle"
              icon={<VideoCameraOutlined />}
              onClick={startCameraScan}
            >
              Start QR Scan
            </Button>
            <Button
              variant="tertiary"
              size="middle"
              style={{ color: "#123" }}
              icon={<UploadOutlined />}
              onClick={() => document.getElementById("qr-file-input")?.click()}
            >
              Upload QR Code Image
            </Button>
            <input
              type="file"
              id="qr-file-input"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileScan}
            />
          </Flex>
        )}
      </div>
    </div>
  );
}
