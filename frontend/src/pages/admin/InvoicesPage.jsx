import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Select from '@cloudscape-design/components/select';
import Link from '@cloudscape-design/components/link';
import Box from '@cloudscape-design/components/box';
import Flashbar from '@cloudscape-design/components/flashbar';
import Alert from '@cloudscape-design/components/alert';
import { useInvoices } from '../../hooks/useInvoices';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ResourceTable, { tablePagesCount } from '../../components/ResourceTable';
import GenerateInvoicesModal from './GenerateInvoicesModal';
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

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { items, meta, status, error, fetchList, generate } = useInvoices();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusFilterOptions[0]);
  const debouncedSearch = useDebouncedValue(searchInput);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [flashItems, setFlashItems] = useState([]);

  function reload() {
    fetchList({
      page,
      limit: LIMIT,
      search: debouncedSearch || undefined,
      status: statusFilter.value || undefined,
    });
  }

  useEffect(reload, [fetchList, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  async function handleGenerate(body) {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await generate(body);
      setModalOpen(false);
      setFlashItems([
        {
          id: 'generate-result',
          type: result.skipped.length > 0 ? 'warning' : 'success',
          header: `Generated ${result.generated} invoice(s) for ${result.billingPeriodStart} – ${result.billingPeriodEnd}`,
          content:
            result.skipped.length > 0
              ? `${result.skipped.length} device(s) skipped: ${result.skipped.map((s) => `device ${s.deviceId} (${s.reason})`).join('; ')}`
              : undefined,
          dismissible: true,
          onDismiss: () => setFlashItems([]),
        },
      ]);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const columnDefinitions = [
    {
      id: 'serialNo',
      header: 'Invoice no.',
      cell: (i) => <Link onFollow={() => navigate(`/admin/invoices/${i.id}`)}>{i.serialNo}</Link>,
    },
    {
      id: 'device',
      header: 'Device',
      cell: (i) => <Link onFollow={() => navigate(`/admin/devices/${i.device.id}`)}>{i.device.serialNo}</Link>,
    },
    { id: 'period', header: 'Period', cell: (i) => `${i.billingPeriodStart} – ${i.billingPeriodEnd}` },
    { id: 'consumption', header: 'Consumption', cell: (i) => i.consumptionUnits },
    { id: 'amount', header: 'Amount', cell: (i) => i.amount },
    {
      id: 'status',
      header: 'Status',
      cell: (i) => <StatusIndicator type={statusIndicatorType[i.status]}>{i.status}</StatusIndicator>,
    },
  ];

  return (
    <SpaceBetween size="l">
      <Flashbar items={flashItems} />
      <ResourceTable
        columnDefinitions={columnDefinitions}
        items={items}
        loading={status === 'loading'}
        header={
          <Header
            variant="h1"
            counter={meta ? `(${meta.total})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Box>
                  <Select
                    selectedOption={statusFilter}
                    onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
                    options={statusFilterOptions}
                  />
                </Box>
                <Button variant="primary" onClick={() => { setFormError(null); setModalOpen(true); }}>
                  Generate invoices
                </Button>
              </SpaceBetween>
            }
          >
            Invoices
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
      <GenerateInvoicesModal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        onSubmit={handleGenerate}
        submitting={submitting}
        error={formError}
      />
    </SpaceBetween>
  );
}
