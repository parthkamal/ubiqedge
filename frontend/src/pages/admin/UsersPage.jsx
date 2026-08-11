import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Select from '@cloudscape-design/components/select';
import Box from '@cloudscape-design/components/box';
import Flashbar from '@cloudscape-design/components/flashbar';
import Alert from '@cloudscape-design/components/alert';
import { useUsers } from '../../hooks/useUsers';
import { useAccounts } from '../../hooks/useAccounts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ResourceTable, { tablePagesCount } from '../../components/ResourceTable';
import ConfirmationModal from '../../components/ConfirmationModal';
import UserFormModal from './UserFormModal';
import { RoleType } from '../../constants/enums';

const LIMIT = 20;

const roleFilterOptions = [
  { label: 'All roles', value: '' },
  { label: 'Admin', value: RoleType.ADMIN },
  { label: 'Customer', value: RoleType.CUSTOMER },
];

export default function UsersPage() {
  const navigate = useNavigate();
  const { items, meta, status, error, fetchList, create, update, remove } = useUsers();
  const { fetchList: fetchAccounts } = useAccounts();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState(roleFilterOptions[0]);
  const debouncedSearch = useDebouncedValue(searchInput);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [resolvingUserId, setResolvingUserId] = useState(null);
  const [flashItems, setFlashItems] = useState([]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function reload() {
    fetchList({ page, limit: LIMIT, search: debouncedSearch || undefined, roleType: roleFilter.value || undefined });
  }

  useEffect(reload, [fetchList, page, debouncedSearch, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  function openCreate() {
    setEditingUser(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(values) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingUser) {
        await update(editingUser.id, values);
      } else {
        await create(values);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user) {
    await update(user.id, { isActive: !user.isActive });
    reload();
  }

  // Customer users don't carry their account id on the user row itself —
  // resolve it via the exact userId filter on GET /accounts (added
  // alongside this), then jump straight to that account's detail page
  async function viewAccount(user) {
    setResolvingUserId(user.id);
    try {
      const result = await fetchAccounts({ userId: user.id, limit: 1 });
      if (result.data.length === 0) {
        setFlashItems([
          {
            id: 'no-account',
            type: 'info',
            content: `${user.firstName} doesn't have an account yet.`,
            dismissible: true,
            onDismiss: () => setFlashItems([]),
          },
        ]);
      } else {
        navigate(`/admin/accounts/${result.data[0].id}`);
      }
    } finally {
      setResolvingUserId(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const columnDefinitions = [
    {
      id: 'name',
      header: 'Name',
      cell: (u) => `${u.firstName} ${u.lastName ?? ''}`.trim(),
    },
    { id: 'email', header: 'Email', cell: (u) => u.email },
    { id: 'role', header: 'Role', cell: (u) => u.roleType },
    { id: 'phone', header: 'Phone', cell: (u) => u.phoneNumber },
    {
      id: 'status',
      header: 'Status',
      cell: (u) => (
        <StatusIndicator type={u.isActive ? 'success' : 'stopped'}>
          {u.isActive ? 'Active' : 'Inactive'}
        </StatusIndicator>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (u) => (
        <SpaceBetween direction="horizontal" size="xxs">
          {u.roleType === RoleType.CUSTOMER && (
            <span title="View account">
              <Button
                variant="icon"
                iconName="user-profile"
                ariaLabel="View account"
                loading={resolvingUserId === u.id}
                onClick={() => viewAccount(u)}
              />
            </span>
          )}
          <span title="Edit">
            <Button variant="icon" iconName="edit" ariaLabel="Edit" onClick={() => openEdit(u)} />
          </span>
          <span title={u.isActive ? 'Deactivate' : 'Activate'}>
            <Button
              variant="icon"
              iconName={u.isActive ? 'status-negative' : 'status-positive'}
              ariaLabel={u.isActive ? 'Deactivate' : 'Activate'}
              onClick={() => toggleActive(u)}
            />
          </span>
          <span title="Delete">
            <Button
              variant="icon"
              iconName="remove"
              ariaLabel="Delete"
              onClick={() => { setDeleteError(null); setDeleteTarget(u); }}
            />
          </span>
        </SpaceBetween>
      ),
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
                    selectedOption={roleFilter}
                    onChange={({ detail }) => setRoleFilter(detail.selectedOption)}
                    options={roleFilterOptions}
                  />
                </Box>
                <Button variant="primary" onClick={openCreate}>
                  Create user
                </Button>
              </SpaceBetween>
            }
          >
            Users
          </Header>
        }
        page={page}
        pageCount={tablePagesCount(meta?.total ?? 0, LIMIT)}
        onPageChange={setPage}
        searchable
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name or email"
      />
      {error && <Alert type="error">{error}</Alert>}
      <UserFormModal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        user={editingUser}
        submitting={submitting}
        error={formError}
      />
      <ConfirmationModal
        visible={Boolean(deleteTarget)}
        onDismiss={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        header="Delete user"
        loading={deleting}
        error={deleteError}
      >
        Delete {deleteTarget?.firstName} {deleteTarget?.lastName ?? ''}? This is a soft delete — the record is
        kept for audit purposes but the user can no longer log in.
      </ConfirmationModal>
    </SpaceBetween>
  );
}
