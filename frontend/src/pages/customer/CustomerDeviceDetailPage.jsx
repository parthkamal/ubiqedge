import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import { useDevices } from '../../hooks/useDevices';
import TelemetryChart from '../../components/TelemetryChart';

function Field({ label, children }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function CustomerDeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { current: device, status, fetchOne } = useDevices();

  useEffect(() => {
    fetchOne(id);
  }, [id, fetchOne]);

  if (status === 'loading' || !device || device.id !== Number(id)) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <SpaceBetween size="l">
      <BreadcrumbGroup
        items={[
          { text: 'My account', href: '/account' },
          { text: device.name, href: `/account/devices/${id}` },
        ]}
        onFollow={(e) => {
          e.preventDefault();
          navigate(e.detail.href);
        }}
      />
      <Container header={<Header variant="h1">{device.name}</Header>}>
        <ColumnLayout columns={3} variant="text-grid">
          <Field label="Serial no.">{device.serialNo}</Field>
          <Field label="Type">{device.type}</Field>
          <Field label="Status">
            <StatusIndicator type={device.isActive ? 'success' : 'stopped'}>
              {device.isActive ? 'Active' : 'Inactive'}
            </StatusIndicator>
          </Field>
        </ColumnLayout>
      </Container>
      <TelemetryChart deviceId={device.id} deviceType={device.type} />
    </SpaceBetween>
  );
}
