'use client';

import { useState, useEffect } from 'react';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
import {
  LoadingOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { Card, Button, message, Alert, Spin, Layout, Typography, Flex } from 'antd';

const { Content } = Layout;
const { Title, Text, Link } = Typography;

type DeviceLocation = {
  lat: number;
  long: number;
  accuracy: number;
};

export type TargetLocation = {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
};

type VerificationResult = {
  targetLocation: TargetLocation;
  deviceLocation: DeviceLocation;
  distance: number;
};

interface LocationVerifierProps {
    targetLocation: TargetLocation;
}

export function LocationVerifier({ targetLocation }: LocationVerifierProps) {
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyLocation = () => {
    setIsLoading(true);
    setError(null);
    setVerificationResult(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const deviceLocation: DeviceLocation = {
            lat: position.coords.latitude,
            long: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          
          const from = point([targetLocation.longitude, targetLocation.latitude]);
          const to = point([deviceLocation.long, deviceLocation.lat]);
          const dist = distance(from, to, { units: 'meters' });

          setVerificationResult({
            targetLocation,
            deviceLocation,
            distance: dist,
          });
          message.success('Location verified successfully.');
          setIsLoading(false);
        },
        (geoError) => {
          console.error('Geolocation error:', geoError);
          let geoErrorMessage = 'Could not get your location. Please enable location services and try again.';
          if (geoError.code === geoError.PERMISSION_DENIED) {
            geoErrorMessage = "Location access was denied. You must grant permission to verify your location.";
          }
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
  };

  useEffect(() => {
    verifyLocation();
  }, [targetLocation]); 

  if (isLoading) {
    return (
        <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
            <Flex justify="center" align="center" style={{height: '100%'}}>
              <Flex vertical align='center' gap="middle">
                 <Spin
                    spinning={true}
                    indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
                    style={{ maxHeight: '100vh' }}
                />
                <Text type="secondary">Getting your location...</Text>
              </Flex>
            </Flex>
        </Layout>
    )
  }

  if (error) {
    return (
        <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
            <Flex justify="center" align="start">
                <Card style={{ width: '100%', maxWidth: '800px' }}>
                    <Alert
                        message={"Verification Failed"}
                        description={error}
                        type="error"
                        showIcon
                        action={
                            <Button type="primary" onClick={verifyLocation} style={{marginTop: 16}}>
                                Try Again
                            </Button>
                        }
                    />
                </Card>
            </Flex>
        </Layout>
    );
  }

  if (verificationResult) {
    const { targetLocation, deviceLocation, distance } = verificationResult;
    const routeUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${deviceLocation.lat}%2C${deviceLocation.long}%3B${targetLocation.latitude}%2C${targetLocation.longitude}`;
    // Correctly construct the bbox and multiple marker parameters.
    const lon1 = deviceLocation.long;
    const lat1 = deviceLocation.lat;
    const lon2 = targetLocation.longitude;
    const lat2 = targetLocation.latitude;
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(lon1, lon2) - 0.01},${Math.min(lat1, lat2) - 0.01},${Math.max(lon1, lon2) + 0.01},${Math.max(lat1, lat2) + 0.01}&layer=mapnik&marker=${lat1},${lon1}&marker=${lat2},${lon2}`;
    
    return (
      <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
        <Content>
          <Flex justify="center" align="start">
            <Card
              style={{ width: '100%', maxWidth: '800px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              <Flex vertical align="center" gap="middle">
                <div style={{ backgroundColor: 'rgba(24, 144, 255, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <EnvironmentOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                </div>
                <Title level={2}>Location Verification</Title>
              </Flex>
              <Flex vertical gap="large" style={{ marginTop: '24px' }}>
                <div>
                  <Title level={4}>Target Location</Title>
                  <Card style={{ background: '#f5f5f5', marginTop: '8px' }}>
                     <p><Text strong>Name:</Text> {targetLocation.name}</p>
                     <p><Text strong>Address:</Text> {targetLocation.address}</p>
                     <p><Text strong>Coordinates:</Text> {targetLocation.latitude.toFixed(6)}, {targetLocation.longitude.toFixed(6)}</p>
                  </Card>
                </div>

                <Flex vertical gap="middle">
                  <Title level={4}>Your Location & Route</Title>
                  <Card style={{ background: '#f5f5f5' }}>
                     <p><Text strong>Your Location:</Text> {deviceLocation.lat.toFixed(6)}, {deviceLocation.long.toFixed(6)}</p>
                     <p><Text strong>Accuracy:</Text> {deviceLocation.accuracy.toFixed(2)} meters</p>
                     <p><Text strong>Distance:</Text> <Text strong>{distance?.toFixed(2)} meters away</Text></p>
                  </Card>
                  <div style={{ aspectRatio: '16/9', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
                    <iframe
                        width="100%"
                        height="100%"
                        loading="lazy"
                        allowFullScreen
                        src={embedUrl}
                      ></iframe>
                  </div>
                  <Link href={routeUrl} target="_blank" rel="noopener noreferrer">
                      View Route on OpenStreetMap
                  </Link>
                </Flex>

                <Button
                  type="primary"
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={verifyLocation}
                  style={{ width: '100%', marginTop: '16px' }}
                >
                  Verify Again
                </Button>
              </Flex>
            </Card>
          </Flex>
        </Content>
      </Layout>
    );
  }
  
  return null; // Should not be reached
}
