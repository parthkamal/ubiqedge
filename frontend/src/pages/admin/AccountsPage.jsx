import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Link from '@cloudscape-design/components/link';
import Box from '@cloudscape-design/components/box';
import Alert from '@cloudscape-design/components/alert';
import { useAccounts } from '../../hooks/useAccounts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ResourceTable, { tablePagesCount } from '../../components/ResourceTable';
import AccountFormModal from './AccountFormModal';
import { ConnectionStatus } from '../../constants/enums';

const LIMIT = 20;

export default function AccountsPage() {
  const navigate = useNavigate();
  const { items, meta, status, error, fetchList, create, updateStatus } = useAccounts();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    fetchList({ page, limit: LIMIT, search: debouncedSearch || undefined });
  }

  useEffect(reload, [fetchList, page, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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

  async function toggleStatus(account) {
    const next = account.status === ConnectionStatus.ACTIVE ? ConnectionStatus.SUSPENDED : ConnectionStatus.ACTIVE;
    await updateStatus(account.id, next);
    reload();
  }

  const columnDefinitions = [
    {
      id: 'accountNo',
      header: 'Account no.',
      cell: (a) => <Link onFollow={() => navigate(`/admin/accounts/${a.id}`)}>{a.accountNo}</Link>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (a) => `${a.user.firstName} ${a.user.lastName ?? ''}`.trim(),
    },
    { id: 'email', header: 'Email', cell: (a) => a.user.email },
    {
      id: 'status',
      header: 'Status',
      cell: (a) => (
        <StatusIndicator type={a.status === ConnectionStatus.ACTIVE ? 'success' : 'stopped'}>
          {a.status}
        </StatusIndicator>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (a) => (
        <Button variant="inline-link" onClick={() => toggleStatus(a)}>
          {a.status === ConnectionStatus.ACTIVE ? 'Suspend' : 'Reactivate'}
        </Button>
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
              <Button variant="primary" onClick={() => { setFormError(null); setModalOpen(true); }}>
                Create account
              </Button>
            }
          >
            Accounts
          </Header>
        }
        page={page}
        pageCount={tablePagesCount(meta?.total ?? 0, LIMIT)}
        onPageChange={setPage}
        searchable
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by account no., name, or email"
      />
      {error && <Alert type="error">{error}</Alert>}
      <AccountFormModal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        error={formError}
      />
    </SpaceBetween>
  );
}
