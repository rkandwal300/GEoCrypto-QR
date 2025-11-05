
'use client';

import {
  CheckCircleFilled,
  CloseCircleFilled,
  ReloadOutlined,
  ExclamationCircleFilled
} from '@ant-design/icons';
import { Card, Button, Alert, Layout, Typography, Flex } from 'antd';

const { Content } = Layout;
const { Title, Text } = Typography;

export type TargetLocation = {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
};

interface LocationVerifierProps {
    targetLocation: TargetLocation | null;
    deviceLocation: { lat: number; long: number } | null;
    distance: number | null;
    error: string | null;
    onScanAgain: () => void;
}

export function LocationVerifier({ targetLocation, deviceLocation, distance, error, onScanAgain }: LocationVerifierProps) {
  
  if (error) {
    return (
      <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
        <Flex justify="center" align="start">
          <Card style={{ width: '100%', maxWidth: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Flex vertical align="center" gap="large" style={{ padding: '24px' }}>
                <ExclamationCircleFilled style={{ fontSize: '64px', color: '#faad14' }} />
                <Title level={3} style={{textAlign: 'center'}}>Permission Required</Title>
                 <Alert
                    message="Verification Failed"
                    description={error}
                    type="warning"
                    showIcon
                />
                <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={onScanAgain} style={{ width: '100%', marginTop: '16px' }}>
                    Try Again
                </Button>
            </Flex>
          </Card>
        </Flex>
      </Layout>
    );
  }

  if (distance !== null && distance > 100) {
     const distanceInKm = distance > 1000;
     const displayDistance = distanceInKm
      ? `${(distance / 1000).toFixed(2)} km`
      : `${distance.toFixed(2)} meters`;

    return (
      <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
        <Flex justify="center" align="start">
          <Card style={{ width: '100%', maxWidth: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Flex vertical align="center" gap="middle" style={{ padding: '24px' }}>
                 <CloseCircleFilled style={{ fontSize: '64px', color: '#ff4d4f' }} />
                 <Title level={3}>Verification Failed</Title>
                 <Text type="secondary" style={{textAlign: 'center'}}>You are too far from the target location.</Text>
                 <Title level={4} style={{ margin: '16px 0', color: '#ff4d4f' }}>
                    You are {displayDistance} away.
                 </Title>
                 <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={onScanAgain} style={{ width: '100%', marginTop: '16px' }}>
                    Scan Again
                </Button>
            </Flex>
          </Card>
        </Flex>
      </Layout>
    );
  }

  if (distance !== null && distance <= 100) {
     return (
      <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
        <Flex justify="center" align="start">
          <Card style={{ width: '100%', maxWidth: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Flex vertical align="center" gap="middle" style={{ padding: '24px' }}>
                 <CheckCircleFilled style={{ fontSize: '64px', color: '#52c41a' }} />
                 <Title level={3}>Verification Successful</Title>
                 <Text type="secondary">Thank you! Your arrival has been confirmed.</Text>
                 <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={onScanAgain} style={{ width: '100%', marginTop: '16px' }}>
                    Scan Another
                </Button>
            </Flex>
          </Card>
        </Flex>
      </Layout>
    );
  }
  
  // This state should ideally not be reached if logic in parent is correct
  return (
     <Layout style={{ minHeight: '100%', padding: '24px', background: '#f0f2f5' }}>
        <Flex justify="center" align="start">
           <Card style={{ width: '100%', maxWidth: '500px' }}>
                <Alert message="Something went wrong" description="Invalid state. Please try scanning again." type="error" />
                 <Button type="primary" onClick={onScanAgain} style={{marginTop: 16}}>
                    Scan Again
                </Button>
           </Card>
        </Flex>
     </Layout>
  );
}
