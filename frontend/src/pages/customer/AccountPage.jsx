import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Cards from '@cloudscape-design/components/cards';
import Link from '@cloudscape-design/components/link';
import { useAccounts } from '../../hooks/useAccounts';
import { useDevices } from '../../hooks/useDevices';
import { ConnectionStatus } from '../../constants/enums';

function Field({ label, children }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { current: account, status: accountStatus, fetchMine } = useAccounts();
  const { items: devices, status: devicesStatus, fetchMine: fetchMyDevices } = useDevices();

  useEffect(() => {
    fetchMine();
    fetchMyDevices();
  }, [fetchMine, fetchMyDevices]);

  if (accountStatus === 'loading' || !account) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h1">My account</Header>}>
        <ColumnLayout columns={3} variant="text-grid">
          <Field label="Account no.">{account.accountNo}</Field>
          <Field label="Name">
            {account.user.firstName} {account.user.lastName ?? ''}
          </Field>
          <Field label="Email">{account.user.email}</Field>
          <Field label="Status">
            <StatusIndicator type={account.status === ConnectionStatus.ACTIVE ? 'success' : 'stopped'}>
              {account.status}
            </StatusIndicator>
          </Field>
        </ColumnLayout>
      </Container>

      <Cards
        loading={devicesStatus === 'loading'}
        header={<Header variant="h2" counter={`(${devices.length})`}>My devices</Header>}
        items={devices}
        cardDefinition={{
          header: (d) => (
            <Link onFollow={() => navigate(`/account/devices/${d.id}`)}>{d.name}</Link>
          ),
          sections: [
            { id: 'serialNo', header: 'Serial no.', content: (d) => d.serialNo },
            { id: 'type', header: 'Type', content: (d) => d.type },
            {
              id: 'status',
              header: 'Status',
              content: (d) => (
                <StatusIndicator type={d.isActive ? 'success' : 'stopped'}>
                  {d.isActive ? 'Active' : 'Inactive'}
                </StatusIndicator>
              ),
            },
          ],
        }}
        empty={
          <Box textAlign="center" color="inherit">
            No devices linked to your account yet
          </Box>
        }
      />
    </SpaceBetween>
  );
}
