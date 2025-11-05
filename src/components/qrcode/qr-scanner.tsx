
"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { decrypt } from "@/lib/crypto";
import { LocationVerifier, TargetLocation } from "./LocationVerifier";
import { Button, message, Typography, Alert, Flex, Spin } from "antd";
import { UploadOutlined, VideoCameraOutlined } from "@ant-design/icons";
import distance from '@turf/distance';
import { point } from '@turf/helpers';

const { Title, Text, Paragraph } = Typography;

const QR_READER_ID = "qr-reader";

type ScannerState = "idle" | "requesting" | "scanning" | "verifying" | "result";
type DeviceLocation = { lat: number; long: number; accuracy: number };

export function QrScanner() {
  const [targetLocation, setTargetLocation] = useState<TargetLocation | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!html5QrcodeRef.current) {
      html5QrcodeRef.current = new Html5Qrcode(QR_READER_ID, { verbose: false });
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

  const handleLocationError = (error: GeolocationPositionError) => {
    let errorMessage = "Could not get your location. Please enable location services in your browser settings and try again.";
    if (error.code === error.PERMISSION_DENIED) {
      errorMessage = "Location access was denied. You must grant permission to verify your location.";
    }
    setVerificationError(errorMessage);
    setScannerState("result");
    message.error(errorMessage);
  };
  
  const requestLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      message.loading({ content: "Requesting location...", key: "location" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          message.success({ content: "Location acquired!", key: "location", duration: 2 });
          resolve(position);
        },
        (error) => {
          message.error({ content: "Failed to get location.", key: "location", duration: 3 });
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const verifyDistance = (qrLocation: TargetLocation, currentDeviceLocation: DeviceLocation) => {
    const from = point([qrLocation.longitude, qrLocation.latitude]);
    const to = point([currentDeviceLocation.long, currentDeviceLocation.lat]);
    const dist = distance(from, to, { units: 'meters' });

    setDistanceToTarget(dist);
    setDeviceLocation(currentDeviceLocation);
    setTargetLocation(qrLocation);
    setScannerState("result");
  };

  const processDecodedText = (decodedText: string) => {
    stopScan();
    setScannerState("verifying");
    try {
      const decrypted = decrypt(decodedText);
      if (!decrypted) {
        throw new Error("Decryption failed. This QR code is invalid or from a different system.");
      }
      const parsed = JSON.parse(decrypted) as TargetLocation;
      if (!parsed.latitude || !parsed.longitude || !parsed.name || !parsed.address) {
        throw new Error("QR code is missing required location data.");
      }
      
      if(deviceLocation) {
        verifyDistance(parsed, deviceLocation);
        message.success("QR Code processed successfully!");
      } else {
         throw new Error("Device location was not available for verification.");
      }

    } catch (e: any) {
      setVerificationError(e.message || "Failed to parse QR code. Please scan a valid GeoCrypt QR code.");
      setScannerState("result");
      message.error("Failed to parse QR code.");
    }
  };

  const startCameraScan = async () => {
    setScannerState("requesting");
    setVerificationError(null);

    // 1. Request Camera
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error("No cameras found on this device.");
      }
    } catch (err: any) {
      let errorMessage = "Failed to access camera. Please check browser permissions.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Camera access was denied. You must grant permission to scan QR codes.";
      }
      setVerificationError(errorMessage);
      setScannerState("result");
      message.error(errorMessage);
      return;
    }

    // 2. Request Location
    try {
      const position = await requestLocation();
      setDeviceLocation({
        lat: position.coords.latitude,
        long: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (err: any) {
       handleLocationError(err);
       return;
    }

    // 3. Start Scanning
    if (!html5QrcodeRef.current) return;
    setScannerState("scanning");
    try {
      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        processDecodedText,
        undefined
      );
    } catch (err: any) {
      stopScan();
      setVerificationError(err.message || "An unexpected error occurred while starting the scanner.");
      setScannerState("result");
    }
  };

  const handleFileScanClick = async () => {
     setScannerState("requesting");
     setVerificationError(null);
     
     // 1. Request Location
     try {
      const position = await requestLocation();
      setDeviceLocation({
        lat: position.coords.latitude,
        long: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      // 2. Open file picker
      fileInputRef.current?.click();

    } catch (err: any) {
       handleLocationError(err);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      setScannerState("idle");
      return;
    }
    const file = event.target.files[0];
    setScannerState("scanning");
    
    try {
      if (!html5QrcodeRef.current) throw new Error("Scanner not initialized.");
      const decodedText = await html5QrcodeRef.current.scanFile(file, true);
      processDecodedText(decodedText);
    } catch (err: any) {
      let friendlyError = "Could not scan the QR code from the image. Please try another image.";
       if (typeof err === "string" && err.includes("No MultiFormat Readers were able to detect the code")) {
        friendlyError = "No QR code could be detected in the uploaded image. Please ensure it's clear and fully visible.";
      } else if (err.message) {
        friendlyError = err.message;
      }
      setVerificationError(friendlyError);
      setScannerState("result");
    } finally {
        // Reset file input value to allow re-selection of the same file
        if (event.target) event.target.value = '';
    }
  };

  const handleScanAgain = () => {
    setTargetLocation(null);
    setDeviceLocation(null);
    setVerificationError(null);
    setDistanceToTarget(null);
    setScannerState("idle");
  };

  if (scannerState === 'result' || scannerState === 'verifying') {
     return (
        <LocationVerifier
            targetLocation={targetLocation}
            deviceLocation={deviceLocation}
            distance={distanceToTarget}
            error={verificationError}
            onScanAgain={handleScanAgain}
        />
     )
  }

  return (
    <div style={{ width: "100%", maxWidth: "800px", margin: "16px auto", padding: "16px" }}>
      <Flex vertical align="center" gap="middle" style={{ padding: "24px" }}>
        <Title level={2} style={{ textAlign: "center", margin: 0 }}>
          Report Your Arrival
        </Title>
        <Paragraph type="secondary" style={{ textAlign: "center", fontSize: 16 }}>
          Please scan the QR code at the gate. We’ll use your location to confirm you’re at the correct site.
        </Paragraph>
      </Flex>

      <div style={{ padding: "0 24px 24px" }}>
        
        <div id={QR_READER_ID} style={{ width: "100%", display: scannerState === "scanning" ? "block" : "none" }}></div>

        {(scannerState === "scanning" || scannerState === "requesting") && (
          <Flex justify="center" align="center" vertical gap="small" style={{ marginTop: 16, minHeight: 100 }}>
            <Spin />
            <Text type="secondary">{scannerState === "requesting" ? "Requesting permissions..." : "Waiting for QR Code..."}</Text>
            {scannerState === "scanning" && (
                <Button onClick={stopScan} danger>Cancel</Button>
            )}
          </Flex>
        )}

        {scannerState === "idle" && (
          <Flex vertical gap="middle">
            <Button type="primary" size="large" icon={<VideoCameraOutlined />} onClick={startCameraScan}>
              Start Camera Scan
            </Button>
            <Button size="large" icon={<UploadOutlined />} onClick={handleFileScanClick}>
              Upload QR Code Image
            </Button>
            <input
              type="file"
              id="qr-file-input"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />
          </Flex>
        )}
      </div>
    </div>
  );
}
