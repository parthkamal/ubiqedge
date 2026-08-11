import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Table from '@cloudscape-design/components/table';
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

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { current: account, status, fetchOne, updateStatus } = useAccounts();
  const { items: devices, status: devicesStatus, fetchList: fetchDevices } = useDevices();

  useEffect(() => {
    fetchOne(id);
  }, [id, fetchOne]);

  useEffect(() => {
    if (account) fetchDevices({ connectionId: account.id, limit: 100 });
  }, [account, fetchDevices]);

  async function toggleStatus() {
    const next = account.status === ConnectionStatus.ACTIVE ? ConnectionStatus.SUSPENDED : ConnectionStatus.ACTIVE;
    await updateStatus(id, next);
  }

  if (status === 'loading' || !account || account.id !== Number(id)) {
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
          { text: 'Accounts', href: '/admin/accounts' },
          { text: account.accountNo, href: `/admin/accounts/${id}` },
        ]}
        onFollow={(e) => {
          e.preventDefault();
          navigate(e.detail.href);
        }}
      />
      <Container
        header={
          <Header
            variant="h1"
            actions={
              <Button onClick={toggleStatus}>
                {account.status === ConnectionStatus.ACTIVE ? 'Suspend' : 'Reactivate'}
              </Button>
            }
          >
            {account.accountNo}
          </Header>
        }
      >
        <ColumnLayout columns={3} variant="text-grid">
          <Field label="Customer">
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

      <Table
        loading={devicesStatus === 'loading'}
        header={<Header variant="h2" counter={`(${devices.length})`}>Linked devices</Header>}
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (d) => <Link onFollow={() => navigate(`/admin/devices/${d.id}`)}>{d.name}</Link>,
          },
          { id: 'serialNo', header: 'Serial no.', cell: (d) => d.serialNo },
          { id: 'type', header: 'Type', cell: (d) => d.type },
          {
            id: 'status',
            header: 'Status',
            cell: (d) => (
              <StatusIndicator type={d.isActive ? 'success' : 'stopped'}>
                {d.isActive ? 'Active' : 'Inactive'}
              </StatusIndicator>
            ),
          },
        ]}
        items={devices}
        trackBy="id"
        empty={
          <Box textAlign="center" color="inherit">
            No devices linked to this account
          </Box>
        }
      />
    </SpaceBetween>
  );
}
