
"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { decrypt } from "@/lib/crypto";
import { LocationVerifier, TargetLocation } from "./LocationVerifier";
import { message, Spin, Flex, Typography, Button } from "antd";
import { UploadOutlined, VideoCameraOutlined } from "@ant-design/icons";
import distance from '@turf/distance';
import { point } from '@turf/helpers';

const { Title, Paragraph } = Typography;

const QR_READER_ID = "qr-reader";

type ScannerState = "idle" | "initializing" | "scanning" | "verifying" | "result";
type DeviceLocation = { lat: number; long: number; accuracy: number };

export function QrScanner() {
  const [targetLocation, setTargetLocation] = useState<TargetLocation | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("initializing");
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Core Functions ---

  useEffect(() => {
    // Initialize the scanner library
    if (!html5QrcodeRef.current) {
      const formats: Html5QrcodeSupportedFormats[] = [
        Html5QrcodeSupportedFormats.QR_CODE,
      ];
      html5QrcodeRef.current = new Html5Qrcode(QR_READER_ID, {
        verbose: false,
        formatsToSupport: formats,
      });
    }

    // Request location permission on initial load
    requestLocation()
      .then(location => {
        setDeviceLocation(location);
        message.success("Location acquired. Ready to scan.", 2);
      })
      .catch(err => {
        handleLocationError(err);
      })
      .finally(() => {
        setScannerState("idle");
      });
      
    // Cleanup scanner on component unmount
    return () => {
      stopScan();
    };
  }, []);

  // Effect to handle camera start AFTER the UI has rendered
  useEffect(() => {
    if (scannerState === 'scanning' && html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
            return;
        }

        html5QrcodeRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => processDecodedText(decodedText),
            undefined 
        ).catch(err => {
            let errorMessage = "Failed to start camera. Please check browser permissions.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage = "Camera access was denied. You must grant permission to scan QR codes.";
            }
            setVerificationError(errorMessage);
            setScannerState("result");
        });
    }
  }, [scannerState]);


  const requestLocation = (): Promise<DeviceLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by your browser."));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            long: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };
  
  const processDecodedText = (decodedText: string) => {
    stopScan();
    setScannerState("verifying");

    if (!deviceLocation) {
        setVerificationError("Could not verify QR code because device location is not available. Please grant location permissions and try again.");
        setScannerState("result");
        return;
    }

    try {
      const decrypted = decrypt(decodedText);
      if (!decrypted) throw new Error("Decryption failed. This QR code is invalid or from a different system.");
      
      const parsed = JSON.parse(decrypted) as TargetLocation;
      if (!parsed.latitude || !parsed.longitude) throw new Error("QR code is missing required location data.");
      
      const from = point([parsed.longitude, parsed.latitude]);
      const to = point([deviceLocation.long, deviceLocation.lat]);
      const dist = distance(from, to, { units: 'meters' });

      setDistanceToTarget(dist);
      setTargetLocation(parsed);
      setScannerState("result");
      message.success("QR Code processed successfully!");

    } catch (e: any) {
      setVerificationError(e.message || "Failed to parse QR code. Please scan a valid GeoCrypt QR code.");
      setScannerState("result");
      message.error(e.message || "Failed to parse QR code.");
    }
  };
  
  const stopScan = () => {
    if (html5QrcodeRef.current?.isScanning) {
      html5QrcodeRef.current.stop().catch(err => {
         // This can fail if the scanner is already stopped, so we can ignore it.
      });
    }
    setScannerState("idle");
  };

  // --- Event Handlers ---

  const startCameraScan = () => {
    if (!deviceLocation) {
      handleLocationError(new Error("Location has not been acquired yet. Please wait or grant permission."));
      return;
    }
    setVerificationError(null);
    setScannerState("scanning");
  };

  const handleFileScanClick = () => {
    if (!deviceLocation) {
      handleLocationError(new Error("Location has not been acquired yet. Please wait or grant permission."));
      return;
    }
    fileInputRef.current?.click();
  };
  
  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      setScannerState("idle");
      return;
    };
    const file = event.target.files[0];
    
    setScannerState("scanning");
    message.loading({ content: 'Scanning image...', key: 'scanning' });
    
    try {
      if (!html5QrcodeRef.current) throw new Error("Scanner not initialized.");
      const decodedText = await html5QrcodeRef.current.scanFile(file, true);
      message.success({ content: 'Scan complete!', key: 'scanning' });
      processDecodedText(decodedText);
    } catch (err: any) {
      let friendlyError = "No QR code could be detected in the uploaded image. Please ensure it's clear and fully visible.";
      message.error({ content: friendlyError, key: 'scanning', duration: 4 });
      setVerificationError(friendlyError);
      setScannerState("result");
    } finally {
        if (event.target) event.target.value = '';
    }
  };

  const handleScanAgain = () => {
    setTargetLocation(null);
    setVerificationError(null);
    setDistanceToTarget(null);
    setScannerState("idle");
  };

  // --- Error Handling ---

  const handleLocationError = (error: GeolocationPositionError | Error) => {
    let errorMessage = "Could not get your location. Please enable location services and try again.";
    if (error instanceof GeolocationPositionError && error.code === error.PERMISSION_DENIED) {
      errorMessage = "Location access was denied. You must grant permission in your browser settings to verify your location.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    setVerificationError(errorMessage);
    setScannerState("result");
    message.error(errorMessage);
  };
  
  // --- Render Logic ---

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

  const isLoading = scannerState === 'initializing';
  const isScanning = scannerState === 'scanning';

  const containerStyle: React.CSSProperties = isScanning
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'black',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : {
        width: "100%",
        maxWidth: "800px",
        margin: "16px auto",
        padding: "16px"
      };
  
  const qrReaderStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
  };

  const videoStyle = `
    #${QR_READER_ID} {
      position: relative;
    }
    #${QR_READER_ID} video {
      width: 100vw !important;
      height: 100vh !important;
      object-fit: cover !important;
      border: none !important;
    }
    #${QR_READER_ID} div {
      box-shadow: none !important;
    }
  `;

  return (
    <div style={containerStyle}>
       {isScanning ? (
        <>
          <style>{videoStyle}</style>
          <div id={QR_READER_ID} style={qrReaderStyle}></div>
          <Button
            onClick={stopScan}
            danger
            style={{ position: 'absolute', bottom: '24px', zIndex: 1001 }}
            size="large"
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
        <Flex vertical align="center" gap="middle" style={{ padding: "24px" }}>
          <Title level={2} style={{ textAlign: "center", margin: 0 }}>
            Report Your Arrival
          </Title>
          <Paragraph type="secondary" style={{ textAlign: "center", fontSize: 16 }}>
            Please scan the QR code at the gate. We’ll use your location to confirm you’re at the correct site.
          </Paragraph>
        </Flex>
  
        <div style={{ padding: "0 24px 24px" }}>
           {/* This div is now only a placeholder for non-scanning state */}
           <div id={QR_READER_ID} style={{ display: 'none' }}></div>
          
          {isLoading ? (
            <Flex justify="center" align="center" vertical gap="small" style={{ marginTop: 16, minHeight: 100 }}>
              <Spin />
              <Typography.Text type="secondary">
                Acquiring location...
              </Typography.Text>
            </Flex>
          ): (
            <Flex vertical gap="middle">
              <Button type="primary" size="large" icon={<VideoCameraOutlined />} onClick={startCameraScan}>
                Start Camera Scan
              </Button>
              <Button size="large" icon={<UploadOutlined />} onClick={handleFileScanClick}>
                Upload QR Code
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
      </>
    )}
    </div>
  );
}
