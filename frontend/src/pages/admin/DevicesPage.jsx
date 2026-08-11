import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Select from '@cloudscape-design/components/select';
import Toggle from '@cloudscape-design/components/toggle';
import Link from '@cloudscape-design/components/link';
import Box from '@cloudscape-design/components/box';
import Alert from '@cloudscape-design/components/alert';
import { useDevices } from '../../hooks/useDevices';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ResourceTable, { tablePagesCount } from '../../components/ResourceTable';
import DeviceFormModal from './DeviceFormModal';
import { DeviceType } from '../../constants/enums';

const LIMIT = 20;

const typeFilterOptions = [
  { label: 'All types', value: '' },
  { label: 'Meter', value: DeviceType.METER },
  { label: 'Tank', value: DeviceType.TANK },
];

export default function DevicesPage() {
  const navigate = useNavigate();
  const { items, meta, status, error, fetchList, create } = useDevices();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState(typeFilterOptions[0]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    fetchList({
      page,
      limit: LIMIT,
      search: debouncedSearch || undefined,
      type: typeFilter.value || undefined,
      unassigned: unassignedOnly || undefined,
    });
  }

  useEffect(reload, [fetchList, page, debouncedSearch, typeFilter, unassignedOnly]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, unassignedOnly]);

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
    {
      id: 'name',
      header: 'Name',
      cell: (d) => (
        <Link onFollow={() => navigate(`/admin/devices/${d.id}`)}>{d.name}</Link>
      ),
    },
    { id: 'serialNo', header: 'Serial no.', cell: (d) => d.serialNo },
    { id: 'type', header: 'Type', cell: (d) => d.type },
    {
      id: 'account',
      header: 'Linked account',
      cell: (d) =>
        d.connection ? (
          <Link onFollow={() => navigate(`/admin/accounts/${d.connection.id}`)}>{d.connection.accountNo}</Link>
        ) : (
          <StatusIndicator type="pending">Unassigned</StatusIndicator>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (d) => (
        <StatusIndicator type={d.isActive ? 'success' : 'stopped'}>
          {d.isActive ? 'Active' : 'Inactive'}
        </StatusIndicator>
      ),
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
                <Box padding={{ top: 'xs' }}>
                  <Toggle checked={unassignedOnly} onChange={({ detail }) => setUnassignedOnly(detail.checked)}>
                    Unassigned only
                  </Toggle>
                </Box>
                <Button variant="primary" onClick={() => { setFormError(null); setModalOpen(true); }}>
                  Create device
                </Button>
              </SpaceBetween>
            }
          >
            Devices
          </Header>
        }
        page={page}
        pageCount={tablePagesCount(meta?.total ?? 0, LIMIT)}
        onPageChange={setPage}
        searchable
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name or serial no."
      />
      {error && <Alert type="error">{error}</Alert>}
      <DeviceFormModal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        error={formError}
      />
    </SpaceBetween>
  );
}
