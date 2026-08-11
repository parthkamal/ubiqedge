import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Select from '@cloudscape-design/components/select';
import Link from '@cloudscape-design/components/link';
import Box from '@cloudscape-design/components/box';
import Alert from '@cloudscape-design/components/alert';
import { useInvoices } from '../../hooks/useInvoices';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ResourceTable, { tablePagesCount } from '../../components/ResourceTable';
import { InvoiceStatus } from '../../constants/enums';

const LIMIT = 20;

const statusFilterOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: InvoiceStatus.PENDING },
  { label: 'Paid', value: InvoiceStatus.PAID },
  { label: 'Cancelled', value: InvoiceStatus.CANCELLED },
];

const statusIndicatorType = {
  [InvoiceStatus.PENDING]: 'pending',
  [InvoiceStatus.PAID]: 'success',
  [InvoiceStatus.CANCELLED]: 'stopped',
};

export default function CustomerInvoicesPage() {
  const navigate = useNavigate();
  const { items, meta, status, error, fetchMine } = useInvoices();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusFilterOptions[0]);
  const debouncedSearch = useDebouncedValue(searchInput);

  useEffect(() => {
    fetchMine({
      page,
      limit: LIMIT,
      search: debouncedSearch || undefined,
      status: statusFilter.value || undefined,
    });
  }, [fetchMine, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const columnDefinitions = [
    {
      id: 'serialNo',
      header: 'Invoice no.',
      cell: (i) => <Link onFollow={() => navigate(`/invoices/${i.id}`)}>{i.serialNo}</Link>,
    },
    {
      id: 'device',
      header: 'Device',
      cell: (i) => <Link onFollow={() => navigate(`/account/devices/${i.device.id}`)}>{i.device.name}</Link>,
    },
    { id: 'period', header: 'Period', cell: (i) => `${i.billingPeriodStart} – ${i.billingPeriodEnd}` },
    { id: 'amount', header: 'Amount', cell: (i) => i.amount },
    { id: 'dueDate', header: 'Due date', cell: (i) => i.dueDate ?? '—' },
    {
      id: 'status',
      header: 'Status',
      cell: (i) => <StatusIndicator type={statusIndicatorType[i.status]}>{i.status}</StatusIndicator>,
    },
  ];

  return (
    <SpaceBetween size="l">
      <ResourceTable
        columnDefinitions={columnDefinitions}
        items={items}
        loading={status === 'loading'}
        header={
          <Header
            variant="h1"
            counter={meta ? `(${meta.total})` : undefined}
            actions={
              <Box>
                <Select
                  selectedOption={statusFilter}
                  onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
                  options={statusFilterOptions}
                />
              </Box>
            }
          >
            My invoices
          </Header>
        }
        page={page}
        pageCount={tablePagesCount(meta?.total ?? 0, LIMIT)}
        onPageChange={setPage}
        searchable
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by invoice no."
      />
      {error && <Alert type="error">{error}</Alert>}
    </SpaceBetween>
  );
}
