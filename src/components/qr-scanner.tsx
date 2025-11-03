
'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  UploadOutlined,
  KeyOutlined,
  LoadingOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { Card, Button, message, Alert, Spin, Layout, Typography, Flex, Space } from 'antd';
import { decryptData } from '@/lib/crypto';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

const MAX_ALLOWED_DISTANCE_METERS = 100;

type DeviceLocation = {
  lat: number;
  long: number;
  accuracy: number;
};

type QrCodeData = {
  data: any;
  location?: {
    lat: number;
    long: number;
  };
};

type ScannedDataType = {
  qrData: QrCodeData;
  deviceLocation?: DeviceLocation;
  distance?: number;
};

/**
 * Calculates the distance between two points on Earth in meters using the Haversine formula.
 */
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readerId = 'qr-code-reader-video';

  const processDecodedText = (decodedText: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch((err) => console.log('Error stopping scanner', err));
    }
    setIsLoading(true);
    setError(null);
    setScannedData(null);
    setIsScanningFile(false);

    try {
      const decrypted = decryptData(decodedText) as QrCodeData;

      if (!decrypted.location || typeof decrypted.location.lat !== 'number' || typeof decrypted.location.long !== 'number') {
        throw new Error("QR code is missing valid location data.");
      }
      
      const qrLocation = decrypted.location;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const deviceLocation: DeviceLocation = {
              lat: position.coords.latitude,
              long: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };

            const distance = getDistanceInMeters(
              qrLocation.lat,
              qrLocation.long,
              deviceLocation.lat,
              deviceLocation.long
            );

            if (distance > MAX_ALLOWED_DISTANCE_METERS) {
              const distanceError = `You are not at the required location. You are ~${distance.toFixed(0)} meters away.`;
              setError(distanceError);
              message.error(distanceError);
              setIsLoading(false);
              return;
            }

            setScannedData({ qrData: decrypted, deviceLocation, distance });
            message.success('QR code decrypted and location verified.');
            setIsLoading(false);
          },
          (geoError) => {
            console.error('Geolocation error:', geoError);
            const geoErrorMessage = 'Could not get your location. Please enable location services to verify the QR code.';
            setError(geoErrorMessage);
message.error(geoErrorMessage);
            setIsLoading(false);
          },
          { enableHighAccuracy: true }
        );
      } else {
        const noGeoMessage = "Geolocation is not supported by your browser.";
        setError(noGeoMessage);
        message.error(noGeoMessage);
        setIsLoading(false);
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Invalid or corrupted QR code.';
      setError(errorMessage);
      setScannedData(null); // Clear previous data on error
      message.error(errorMessage);
      setIsLoading(false);
    }
  };

  const startScanner = async () => {
    if (!containerRef.current) return;
    if (error) setError(null);
    if (scannedData) setScannedData(null);
    
    setIsLoading(true);

    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Failed to stop existing scanner.", err);
      }
    }

    const html5QrCode = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = html5QrCode;

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        // Ensure qrbox size is at least 50px, but not larger than the viewfinder.
        const qrboxSize = Math.max(50, Math.floor(minEdge * 0.7));
        return {
          width: qrboxSize,
          height: qrboxSize,
        };
      },
      showTorchButtonIfSupported: true,
      rememberLastUsedCamera: true,
    };

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        processDecodedText(decodedText);
      }
    };

    const qrCodeErrorCallback = () => {
      // Don't show 'not found' errors to keep the UI clean
    };

    try {
      await scannerRef.current.start(
        { facingMode: 'environment' },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
      setHasCameraPermission(true);
    } catch (err: any) {
      let userMessage = 'Camera permission denied. Please grant camera access in your browser settings to use the scanner.';
      if (err.name === 'NotAllowedError') {
        userMessage = 'Camera access was denied. You\'ll need to grant permission in your browser settings to use the scanner.';
        setHasCameraPermission(false);
      } else if (err.message && err.message.includes('not found')) {
        userMessage = 'No suitable camera found on this device.';
      } else {
        userMessage = 'Failed to start the camera. Please check permissions and ensure no other app is using it.';
      }
      setError(userMessage);
      message.error(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && containerRef.current && !scannedData && !error) {
      startScanner();
    }
    
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch((err) => {
          console.error('Failed to stop the scanner on cleanup.', err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current, scannedData, error]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      
      setScannedData(null);
      setError(null);
      setIsLoading(true);
      setIsScanningFile(true); 

      // The div must be in the DOM for scanFile to work.
      const fileScanner = new Html5Qrcode(readerId, { verbose: false });

      try {
        const decodedText = await fileScanner.scanFile(file, false);
        processDecodedText(decodedText);
      } catch (err: any) {
        const errorMessage = 'Could not scan the QR code from the image. Please try a different file.';
        setError(errorMessage);
        message.error(errorMessage);
        setIsLoading(false);
      } finally {
        setIsScanningFile(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  if (scannedData) {
    return (
      <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
        <Content>
          <Flex justify="center" align="start">
            <Card
              style={{ width: '100%', maxWidth: '800px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              <Flex vertical align="center" gap="middle">
                <div style={{ backgroundColor: 'rgba(24, 144, 255, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <KeyOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                </div>
                <Title level={2}>Scan Result</Title>
              </Flex>
              <Flex vertical gap="large" style={{ marginTop: '24px' }}>
                <div>
                  <Title level={4}>Decrypted Data</Title>
                  <Card style={{ background: '#f5f5f5', marginTop: '8px' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                      {typeof scannedData.qrData.data === 'string'
                        ? scannedData.qrData.data
                        : JSON.stringify(scannedData.qrData.data, null, 2)}
                    </pre>
                  </Card>
                </div>

                {scannedData.deviceLocation && scannedData.qrData.location && (
                  <Flex vertical gap="middle">
                    <Title level={4}><EnvironmentOutlined style={{ marginRight: 8, color: '#1890ff' }} />Location Details</Title>
                    <Card style={{ background: '#f5f5f5' }}>
                       <p><Text strong>QR Target Location:</Text> {scannedData.qrData.location.lat.toFixed(6)}, {scannedData.qrData.location.long.toFixed(6)}</p>
                       <p><Text strong>Your Location:</Text> {scannedData.deviceLocation.lat.toFixed(6)}, {scannedData.deviceLocation.long.toFixed(6)}</p>
                       <p><Text strong>Accuracy:</Text> {scannedData.deviceLocation.accuracy.toFixed(2)} meters</p>
                       <p><Text strong>Distance:</Text> <Text type="success" strong>{scannedData.distance?.toFixed(2)} meters away</Text></p>
                    </Card>
                    <div style={{ aspectRatio: '16/9', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
                      <iframe
                        width="100%"
                        height="100%"
                        loading="lazy"
                        allowFullScreen
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${scannedData.deviceLocation.long - 0.005}%2C${scannedData.deviceLocation.lat - 0.005}%2C${scannedData.deviceLocation.long + 0.005}%2C${scannedData.deviceLocation.lat + 0.005}&layer=mapnik&marker=${scannedData.deviceLocation.lat}%2C${scannedData.deviceLocation.long}`}
                      ></iframe>
                    </div>
                  </Flex>
                )}

                <Button
                  type="primary"
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setScannedData(null);
                    setError(null);
                    scannerRef.current = null;
                  }}
                  style={{ width: '100%', marginTop: '16px' }}
                >
                  Scan Another Code
                </Button>
              </Flex>
            </Card>
          </Flex>
        </Content>
      </Layout>
    );
  }

  const shouldShowScannerUI = !scannedData && (!error || isLoading);

  return (
    <>
      <style jsx global>{`
        #${readerId} {
          background: #000;
        }
        #${readerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        .ant-spin-nested-loading, .ant-spin-container {
          height: 100%;
        }
      `}</style>
      <Layout style={{ position: 'fixed', inset: 0, background: '#000' }}>
          <Content style={{ height: '100%' }}>
              <Spin
                  spinning={isLoading}
                  indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
                  tip={isLoading ? "Starting camera..." : null}
                  style={{ maxHeight: '100vh' }}
              >
                  <div id={readerId} ref={containerRef} style={{ width: '100%', height: '100%', display: shouldShowScannerUI ? 'block' : 'none' }} />
                  
                  {error && !isLoading && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, background: 'rgba(0,0,0,0.8)', padding: '16px' }}>
                          <Alert
                              message={"Scan Failed"}
                              description={error}
                              type="error"
                              showIcon
                              action={
                                  <Space direction="vertical" style={{ marginTop: 16, width: '100%' }}>
                                  <Button type="primary" onClick={() => {
                                      setScannedData(null);
                                      setError(null);
                                      scannerRef.current = null;
                                  }} style={{width: '100%'}}>
                                      Try Scanning Again
                                  </Button>
                                  <Button onClick={() => fileInputRef.current?.click()} style={{width: '100%'}}>
                                      Upload File Instead
                                  </Button>
                                  </Space>
                              }
                              style={{ maxWidth: '400px', width: '100%' }}
                          />
                      </div>
                  )}
              </Spin>
          </Content>
          
          <Footer style={{ position: 'absolute', bottom: 0, width: '100%', background: 'transparent', textAlign: 'center', padding: '24px', zIndex: 10, visibility: shouldShowScannerUI ? 'visible' : 'hidden' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/gif"
                style={{ display: 'none' }}
              />
              <Button
                type="primary"
                ghost
                size="large"
                icon={<UploadOutlined />}
                onClick={() => fileInputRef.current?.click()}
                loading={isScanningFile}
                style={{ background: 'rgba(255,255,255,0.9)', color: '#1890ff', fontWeight: 'bold', border: 'none' }}
              >
                Upload QR Code
              </Button>
          </Footer>
      </Layout>
    </>
  );
}
