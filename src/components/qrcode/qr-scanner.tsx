
"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { decrypt } from "@/lib/crypto";
import { LocationVerifier, TargetLocation } from "./LocationVerifier";
import { message, Spin, Flex, Typography, Button } from "antd";
import { UploadOutlined, VideoCameraOutlined } from "@ant-design/icons";
import distance from '@turf/distance';
import { point } from '@turf/helpers';

const { Title, Paragraph } = Typography;

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
    // Initialize the scanner object only once.
    if (!html5QrcodeRef.current) {
      html5QrcodeRef.current = new Html5Qrcode(QR_READER_ID, { verbose: false });
    }

    const scanner = html5QrcodeRef.current;
    
    // Cleanup function to stop the scanner when the component unmounts.
    return () => {
      if (scanner?.isScanning) {
        scanner.stop().catch(err => console.error("Failed to stop scanner on unmount", err));
      }
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
      errorMessage = "Location access was denied. You must grant permission in your browser settings to verify your location.";
    }
    setVerificationError(errorMessage);
    setScannerState("result");
    message.error(errorMessage);
  };
  
  const requestLocation = (): Promise<DeviceLocation> => {
    setScannerState("requesting");
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setScannerState("idle");
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      message.loading({ content: "Requesting location...", key: "location" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          message.success({ content: "Location acquired!", key: "location", duration: 2 });
          resolve({
            lat: position.coords.latitude,
            long: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          message.error({ content: "Failed to get location.", key: "location", duration: 3 });
          setScannerState("idle");
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

  const processDecodedText = (decodedText: string, location: DeviceLocation) => {
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
      
      verifyDistance(parsed, location);
      message.success("QR Code processed successfully!");

    } catch (e: any) {
      setVerificationError(e.message || "Failed to parse QR code. Please scan a valid GeoCrypt QR code.");
      setScannerState("result");
      message.error("Failed to parse QR code.");
    }
  };

  const startCameraScan = async () => {
    setVerificationError(null);
    let location: DeviceLocation;
    try {
      location = await requestLocation();
    } catch (err: any) {
       handleLocationError(err);
       return;
    }

    if (!html5QrcodeRef.current) return;
    setScannerState("scanning");
    try {
      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => processDecodedText(decodedText, location),
        undefined
      );
    } catch (err: any) {
      let errorMessage = "Failed to start camera. Please check browser permissions and ensure no other app is using the camera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Camera access was denied. You must grant permission to scan QR codes.";
      }
      stopScan();
      setVerificationError(errorMessage);
      setScannerState("result");
    }
  };

  const handleFileScanClick = async () => {
     setVerificationError(null);
     
     try {
      const location = await requestLocation();
      // Store location temporarily so it can be retrieved after file selection
      fileInputRef.current?.setAttribute('data-location', JSON.stringify(location));
      // Programmatically click the hidden file input
      fileInputRef.current?.click();
      // Reset state to idle so the UI doesn't show a spinner while file dialog is open
      setScannerState("idle"); 
    } catch (err: any) {
       handleLocationError(err);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return; // User cancelled the file dialog
    }
    const file = event.target.files[0];
    const locationString = fileInputRef.current?.getAttribute('data-location');
    
    if (!locationString) {
      setVerificationError('Device location was not available for verification. Please try again.');
      setScannerState('result');
      return;
    }
    const location = JSON.parse(locationString);

    setScannerState("scanning");
    message.loading({ content: 'Scanning image...', key: 'scanning' });
    
    try {
      if (!html5QrcodeRef.current) throw new Error("Scanner not initialized.");
      const decodedText = await html5QrcodeRef.current.scanFile(file, true);
      message.success({ content: 'Scan complete!', key: 'scanning' });
      processDecodedText(decodedText, location);
    } catch (err: any) {
      let friendlyError = "Could not scan the QR code from the image. Please try another image.";
       if (typeof err === "string" && err.includes("No MultiFormat Readers were able to detect the code")) {
        friendlyError = "No QR code could be detected in the uploaded image. Please ensure it's clear and fully visible.";
      } else if (err.message) {
        friendlyError = err.message;
      }
      message.error({ content: friendlyError, key: 'scanning', duration: 4 });
      setVerificationError(friendlyError);
      setScannerState("result");
    } finally {
        // Reset the input value to allow scanning the same file again
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
        
        <div id={QR_READER_ID} style={{ width: "100%", display: scannerState === "scanning" ? "block" : "none", border: '1px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' }}></div>

        {(scannerState === "scanning" || scannerState === "requesting") && (
          <Flex justify="center" align="center" vertical gap="small" style={{ marginTop: 16, minHeight: 100 }}>
            <Spin />
            <Typography.Text type="secondary">{scannerState === "requesting" ? "Requesting permissions..." : "Waiting for QR Code..."}</Typography.Text>
            {scannerState === "scanning" && (
                <Button onClick={stopScan} danger style={{marginTop: '16px'}}>Cancel</Button>
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
