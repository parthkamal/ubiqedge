import { useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useUsers } from '../hooks/useUsers';

function Field({ label, children }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { current, status, fetchMe } = useUsers();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (status === 'loading' || !current) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <Container header={<Header variant="h1">My profile</Header>}>
      <ColumnLayout columns={2} variant="text-grid">
        <Field label="Name">
          {current.firstName} {current.lastName ?? ''}
        </Field>
        <Field label="Role">{current.roleType}</Field>
        <Field label="Email">{current.email}</Field>
        <Field label="Phone number">{current.phoneNumber}</Field>
        <Field label="Address">{current.address}</Field>
        <Field label="Pincode">{current.pincode}</Field>
        <Field label="Status">
          <StatusIndicator type={current.isActive ? 'success' : 'stopped'}>
            {current.isActive ? 'Active' : 'Inactive'}
          </StatusIndicator>
        </Field>
      </ColumnLayout>
    </Container>
  );
}
