'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { decrypt } from '@/lib/crypto';
import { LocationVerifier, TargetLocation } from './location-verifier';
import { Button, Card, message, Typography, Alert, Flex, Spin } from 'antd';
import { QrcodeOutlined, UploadOutlined, VideoCameraOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const QR_READER_ID = 'qr-reader';

export function QrScanner() {
  const [targetLocation, setTargetLocation] = useState<TargetLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<string>('idle'); // idle, scanning, success
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
        console.warn('QR scanner stop failed', e);
      }
    }
  };

  const processDecodedText = (decodedText: string) => {
    stopScan();
    try {
      const decrypted = decrypt(decodedText);
      if (!decrypted) {
        throw new Error('Decryption failed. The QR code may be invalid.');
      }

      const parsed = JSON.parse(decrypted);

      if (
        !parsed.latitude ||
        !parsed.longitude ||
        !parsed.name ||
        !parsed.address
      ) {
        throw new Error('QR code is missing required location data.');
      }

      setTargetLocation({
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        name: parsed.name,
        address: parsed.address,
      });
      setScannerState('success');
      message.success('QR Code Scanned Successfully!');
    } catch (e: any) {
      setError(
        e.message ||
          'Failed to parse QR code. Please scan a valid GeoCrypt QR code.'
      );
      setScannerState('idle');
      message.error(
        'Failed to parse QR code. Please ensure it is a valid code.'
      );
    }
  };

  const startCameraScan = async () => {
    setError(null);
    setScannerState('scanning');
    
    if (!html5QrcodeRef.current) return;
    if (html5QrcodeRef.current.isScanning) {
        await stopScan();
    }

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No cameras found on this device.');
      }
      
      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        processDecodedText,
        undefined
      );

    } catch (err: any) {
        console.error('Camera scan failed', err);
        let errorMessage = "Failed to start camera. Check browser permissions."
        if (err.name === "NotAllowedError") {
            errorMessage = "Camera access was denied. Please enable it in your browser settings.";
        }
        setError(errorMessage);
        setScannerState('idle');
    }
  };

  const handleFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    setError(null);
    setScannerState('scanning');
    try {
      if (html5QrcodeRef.current?.isScanning) {
        await stopScan();
      }
      if (!html5QrcodeRef.current) return;
      
      const decodedText = await html5QrcodeRef.current.scanFile(file, true);
      processDecodedText(decodedText);
    } catch (err: any) {
      console.error('File scan failed', err);
      setError(
        err.message ||
          'Could not scan the QR code from the image. Please try another image.'
      );
      setScannerState('idle');
    }
  };


  if (targetLocation) {
    return <LocationVerifier targetLocation={targetLocation} />;
  }

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '16px auto', padding: '16px' }}>
      <Card>
        <Flex vertical align="center" gap="middle" style={{ padding: '24px' }}>
            <QrcodeOutlined style={{fontSize: '48px', color: '#1890ff'}} />
            <Title level={2} style={{ marginTop: 0, textAlign: 'center' }}>
                Scan QR Code
            </Title>
            <Paragraph type="secondary" style={{ textAlign: 'center', maxWidth: '450px' }}>
                Use your camera to scan a GeoCrypt QR code or upload an image to begin the location verification process.
            </Paragraph>
        </Flex>
        
        <div style={{ padding: '0 24px 24px' }}>
            {error && <Alert message={error} type="error" showIcon style={{marginBottom: 16}}/>}
            
            <div id={QR_READER_ID} style={{ width: '100%', display: scannerState === 'scanning' ? 'block' : 'none' }}></div>
            
            {scannerState === 'scanning' &&
                 <Flex justify="center" align="center" vertical gap="small" style={{marginTop: 16}}>
                    <Spin />
                    <Text type="secondary">Waiting for QR Code...</Text>
                    <Button onClick={stopScan} danger>Cancel</Button>
                 </Flex>
            }

            {scannerState === 'idle' &&
                <Flex vertical gap="middle">
                     <Button type="primary" size="large" icon={<VideoCameraOutlined />} onClick={startCameraScan}>
                        Start Camera Scan
                    </Button>
                    <Button size="large" icon={<UploadOutlined />} onClick={() => document.getElementById('qr-file-input')?.click()}>
                        Upload QR Code Image
                    </Button>
                    <input
                        type="file"
                        id="qr-file-input"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileScan}
                    />
                </Flex>
            }
        </div>
      </Card>
    </div>
  );
}
