import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Grid from '@cloudscape-design/components/grid';
import Cards from '@cloudscape-design/components/cards';
import Button from '@cloudscape-design/components/button';
import Spinner from '@cloudscape-design/components/spinner';
import { useDevices } from '../../hooks/useDevices';
import { useAccounts } from '../../hooks/useAccounts';
import { useInvoices } from '../../hooks/useInvoices';
import { useUsers } from '../../hooks/useUsers';
import { RoleType, InvoiceStatus } from '../../constants/enums';

const quickLinks = [
  { text: 'Users', href: '/admin/users', description: 'Create and manage Admin/Customer accounts' },
  { text: 'Accounts', href: '/admin/accounts', description: 'Link customers to billing accounts' },
  { text: 'Devices', href: '/admin/devices', description: 'Meters and tanks, assignment status' },
  { text: 'Pricing', href: '/admin/pricing', description: 'FIXED and SLAB rate configs' },
  { text: 'Invoices', href: '/admin/invoices', description: 'Generate and review billing runs' },
];

function StatTile({ label, value, loading, onClick }) {
  return (
    <Container disableContentPaddings={false}>
      <SpaceBetween size="xs">
        <Box variant="awsui-key-label" color="text-body-secondary">
          {label}
        </Box>
        {loading ? (
          <Spinner size="normal" />
        ) : (
          <Box fontSize="display-l" fontWeight="bold">
            {value}
          </Box>
        )}
        {onClick && (
          <Button variant="inline-link" onClick={onClick}>
            View
          </Button>
        )}
      </SpaceBetween>
    </Container>
  );
}

// the admin's landing screen — per-resource counts pulled cheaply via
// limit=1 list calls (only `meta.total` is used, not the returned rows),
// so this costs one lightweight paginated query per stat, same endpoints
// the list pages already use
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { fetchList: fetchDevices } = useDevices();
  const { fetchList: fetchAccounts } = useAccounts();
  const { fetchList: fetchInvoices } = useInvoices();
  const { fetchList: fetchUsers } = useUsers();

  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAccounts({ limit: 1 }),
      fetchDevices({ limit: 1 }),
      fetchDevices({ limit: 1, unassigned: true }),
      fetchInvoices({ limit: 1, status: InvoiceStatus.PENDING }),
      fetchUsers({ limit: 1, roleType: RoleType.CUSTOMER }),
    ]).then(([accounts, devices, unassignedDevices, pendingInvoices, customers]) => {
      if (cancelled) return;
      setStats({
        accounts: accounts.meta.total,
        devices: devices.meta.total,
        unassignedDevices: unassignedDevices.meta.total,
        pendingInvoices: pendingInvoices.meta.total,
        customers: customers.meta.total,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = !stats;

  return (
    <SpaceBetween size="l">
      <Header variant="h1" description="Rivergate Municipal Water Utility — operations overview">
        Dashboard
      </Header>

      <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }]}>
        <StatTile
          label="Customers"
          value={stats?.customers}
          loading={loading}
          onClick={() => navigate('/admin/users')}
        />
        <StatTile
          label="Billing accounts"
          value={stats?.accounts}
          loading={loading}
          onClick={() => navigate('/admin/accounts')}
        />
        <StatTile
          label="Devices (unassigned)"
          value={loading ? undefined : `${stats.devices} (${stats.unassignedDevices})`}
          loading={loading}
          onClick={() => navigate('/admin/devices')}
        />
        <StatTile
          label="Pending invoices"
          value={stats?.pendingInvoices}
          loading={loading}
          onClick={() => navigate('/admin/invoices')}
        />
      </Grid>

      <Cards
        header={<Header variant="h2">Manage</Header>}
        cardDefinition={{
          header: (item) => (
            <Button variant="inline-link" onClick={() => navigate(item.href)}>
              {item.text}
            </Button>
          ),
          sections: [{ id: 'description', content: (item) => item.description }],
        }}
        items={quickLinks}
        trackBy="href"
        cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 3 }]}
      />
    </SpaceBetween>
  );
}
