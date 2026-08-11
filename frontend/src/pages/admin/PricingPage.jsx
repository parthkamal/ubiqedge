import { useEffect, useState } from 'react';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Select from '@cloudscape-design/components/select';
import Link from '@cloudscape-design/components/link';
import Box from '@cloudscape-design/components/box';
import Alert from '@cloudscape-design/components/alert';
import { usePricing } from '../../hooks/usePricing';
import ResourceTable, { tablePagesCount } from '../../components/ResourceTable';
import PricingFormModal from './PricingFormModal';
import PricingConfigDetailModal from './PricingConfigDetailModal';
import { DeviceType, RateType } from '../../constants/enums';

const LIMIT = 20;

const typeFilterOptions = [
  { label: 'All types', value: '' },
  { label: 'Meter', value: DeviceType.METER },
  { label: 'Tank', value: DeviceType.TANK },
];

function formatSlabs(slabs) {
  return slabs
    .map((s) => `${s.slabFrom}–${s.slabTo ?? '∞'} @ ${s.rate}`)
    .join(', ');
}

export default function PricingPage() {
  const { items, meta, status, error, fetchList, create } = usePricing();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState(typeFilterOptions[0]);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [detailConfig, setDetailConfig] = useState(null);

  function reload() {
    fetchList({ page, limit: LIMIT, type: typeFilter.value || undefined });
  }

  useEffect(reload, [fetchList, page, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  async function handleCreate(values) {
    setSubmitting(true);
    setFormError(null);
    try {
      await create(values);
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const columnDefinitions = [
    { id: 'type', header: 'Device type', cell: (c) => c.type },
    { id: 'rateType', header: 'Rate type', cell: (c) => c.rateType },
    {
      id: 'rate',
      header: 'Rate',
      cell: (c) => (c.rateType === RateType.FIXED ? c.fixedRate : formatSlabs(c.slabs)),
    },
    {
      id: 'effectiveFrom',
      header: 'Effective from',
      cell: (c) => new Date(c.effectiveFrom).toLocaleDateString(),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (c) => (
        <StatusIndicator type={c.effectiveTo === null ? 'success' : 'stopped'}>
          {c.effectiveTo === null ? 'Active' : 'Superseded'}
        </StatusIndicator>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (c) => <Link onFollow={() => setDetailConfig(c)}>View details</Link>,
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
              <SpaceBetween direction="horizontal" size="xs">
                <Box>
                  <Select
                    selectedOption={typeFilter}
                    onChange={({ detail }) => setTypeFilter(detail.selectedOption)}
                    options={typeFilterOptions}
                  />
                </Box>
                <Button variant="primary" onClick={() => { setFormError(null); setModalOpen(true); }}>
                  Create pricing config
                </Button>
              </SpaceBetween>
            }
          >
            Pricing
          </Header>
        }
        page={page}
        pageCount={tablePagesCount(meta?.total ?? 0, LIMIT)}
        onPageChange={setPage}
      />
      {error && <Alert type="error">{error}</Alert>}
      <PricingFormModal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        error={formError}
      />
      <PricingConfigDetailModal
        visible={Boolean(detailConfig)}
        onDismiss={() => setDetailConfig(null)}
        config={detailConfig}
      />
    </SpaceBetween>
  );
}
