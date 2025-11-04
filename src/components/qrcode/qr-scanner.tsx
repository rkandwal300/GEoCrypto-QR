'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
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
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  version: string;
  timestamp: string;
};

type ScannedDataType = {
  qrData: QrCodeData;
  deviceLocation?: DeviceLocation;
  distance?: number;
};

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

  const processDecodedText = async (decodedText: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner during processing', err);
      }
    }
    setIsLoading(true);
    setError(null);
    setScannedData(null);
    setIsScanningFile(false);

    try {
      const decrypted = decryptData(decodedText) as QrCodeData;
      
      // Validate decrypted data structure
      if (!decrypted.latitude || !decrypted.longitude) {
        throw new Error("QR code is missing valid location data (latitude/longitude).");
      }
      
      const qrLocation = { lat: decrypted.latitude, long: decrypted.longitude };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const deviceLocation: DeviceLocation = {
              lat: position.coords.latitude,
              long: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };
            
            const from = point([qrLocation.long, qrLocation.lat]);
            const to = point([deviceLocation.long, deviceLocation.lat]);
            const dist = distance(from, to, { units: 'meters' });

            // Note: For this use case, we are not restricting by distance, just showing the data.
            // If you wanted to enforce a distance check, you would uncomment the following:
            /*
            if (dist > MAX_ALLOWED_DISTANCE_METERS) {
              const distanceError = `You are not at the required location. You are ~${dist.toFixed(0)} meters away.`;
              setError(distanceError);
              message.error(distanceError);
              setIsLoading(false);
              return;
            }
            */

            setScannedData({ qrData: decrypted, deviceLocation, distance: dist });
            message.success('QR code decrypted successfully.');
            setIsLoading(false);
          },
          (geoError) => {
            console.error('Geolocation error:', geoError);
            let geoErrorMessage = 'Could not get your location to compare with the QR code. Please enable location services.';
            if (geoError.code === geoError.PERMISSION_DENIED) {
              geoErrorMessage = "Location access was denied. Location is needed to verify proximity to the QR code's target.";
            }
            // Even if we can't get device location, we can still show the QR data.
            setScannedData({ qrData: decrypted });
            message.warning(geoErrorMessage);
            setIsLoading(false);
          },
          { enableHighAccuracy: true }
        );
      } else {
        const noGeoMessage = "Geolocation is not supported by your browser. Cannot verify distance.";
        setScannedData({ qrData: decrypted });
        message.warning(noGeoMessage);
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
    if (!containerRef.current || (scannerRef.current && scannerRef.current.isScanning)) return;
    
    setIsLoading(true);
    setHasCameraPermission(true);

    const html5QrCode = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = html5QrCode;

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
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
      let userMessage = 'Failed to start the camera. Please check permissions and ensure no other app is using it.';
      if (err.name === 'NotAllowedError') {
        userMessage = 'Camera access was denied. You\'ll need to grant permission in your browser settings to use the scanner.';
        setHasCameraPermission(false);
      } else if (err.message && err.message.includes('not found')) {
        userMessage = 'No suitable camera found on this device.';
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
      const stopScanner = async () => {
        if (scannerRef.current?.isScanning) {
          try {
            await scannerRef.current.stop();
          } catch (err) {
            console.error('Failed to stop the scanner on cleanup.', err);
          }
        }
      };
      stopScanner();
    };
  }, [scannedData, error]); 

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (scannerRef.current?.isScanning) {
        try {
            await scannerRef.current.stop();
        } catch(err) {
            console.error("Error stopping scanner for file upload", err);
        }
      }
      
      setScannedData(null);
      setError(null);
      setIsLoading(true);
      setIsScanningFile(true); 

      const fileScanner = new Html5Qrcode(readerId, { verbose: false });

      try {
        const decodedText = await fileScanner.scanFile(file, false);
        await processDecodedText(decodedText);
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
    const { qrData, deviceLocation, distance } = scannedData;
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
                      {JSON.stringify(qrData, null, 2)}
                    </pre>
                  </Card>
                </div>

                <Flex vertical gap="middle">
                  <Title level={4}><EnvironmentOutlined style={{ marginRight: 8, color: '#1890ff' }} />Location Details</Title>
                  <Card style={{ background: '#f5f5f5' }}>
                     <p><Text strong>QR Target Location:</Text> {qrData.latitude.toFixed(6)}, {qrData.longitude.toFixed(6)}</p>
                     {deviceLocation && (
                       <>
                         <p><Text strong>Your Location:</Text> {deviceLocation.lat.toFixed(6)}, {deviceLocation.long.toFixed(6)}</p>
                         <p><Text strong>Accuracy:</Text> {deviceLocation.accuracy.toFixed(2)} meters</p>
                         <p><Text strong>Distance:</Text> <Text strong>{distance?.toFixed(2)} meters away</Text></p>
                       </>
                     )}
                  </Card>
                  <div style={{ aspectRatio: '16/9', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
                    <iframe
                      width="100%"
                      height="100%"
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${qrData.longitude - 0.005}%2C${qrData.latitude - 0.005}%2C${qrData.longitude + 0.005}%2C${qrData.latitude + 0.005}&layer=mapnik&marker=${qrData.latitude}%2C${qrData.longitude}`}
                    ></iframe>
                  </div>
                </Flex>

                <Button
                  type="primary"
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    scannerRef.current = null;
                    setScannedData(null);
                    setError(null);
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

  const shouldShowScannerUI = !scannedData;

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
                                      scannerRef.current = null;
                                      setScannedData(null);
                                      setError(null);
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
          
          <Footer style={{ position: 'absolute', bottom: 0, width: '100%', background: 'transparent', textAlign: 'center', padding: '24px', zIndex: 10, visibility: shouldShowScannerUI && !error && !isLoading ? 'visible' : 'hidden' }}>
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
