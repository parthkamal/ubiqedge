import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Toggle from '@cloudscape-design/components/toggle';
import Select from '@cloudscape-design/components/select';
import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import { useDevices } from '../../hooks/useDevices';
import { useAccounts } from '../../hooks/useAccounts';
import TelemetryChart from '../../components/TelemetryChart';
import ConfirmationModal from '../../components/ConfirmationModal';

const UNASSIGNED_OPTION = { label: '— Unassigned —', value: null };

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { current: device, status, fetchOne, update, remove } = useDevices();
  const { items: accounts, fetchList: fetchAccounts } = useAccounts();

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [connection, setConnection] = useState(UNASSIGNED_OPTION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    fetchOne(id);
    fetchAccounts({ limit: 100 });
  }, [id, fetchOne, fetchAccounts]);

  useEffect(() => {
    if (device) {
      setName(device.name);
      setIsActive(device.isActive);
      setConnection(
        device.connection ? { label: device.connection.accountNo, value: device.connection.id } : UNASSIGNED_OPTION,
      );
    }
  }, [device]);

  const accountOptions = [
    UNASSIGNED_OPTION,
    ...accounts.map((a) => ({
      label: `${a.accountNo} — ${a.user.firstName} ${a.user.lastName ?? ''}`.trim(),
      value: a.id,
    })),
  ];

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await update(id, { name, isActive, connectionId: connection.value });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(id);
      navigate('/admin/devices');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (status === 'loading' || !device || device.id !== Number(id)) {
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
          { text: 'Devices', href: '/admin/devices' },
          { text: device.serialNo, href: `/admin/devices/${id}` },
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
              <Button onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>Delete device</Button>
            }
          >
            {device.serialNo}
          </Header>
        }
      >
        <SpaceBetween size="l">
          {error && <Alert type="error">{error}</Alert>}
          <ColumnLayout columns={2} variant="text-grid">
            <FormField label="Name">
              <Input value={name} onChange={({ detail }) => setName(detail.value)} />
            </FormField>
            <FormField label="Type">
              <Box>{device.type}</Box>
            </FormField>
            <FormField label="Active">
              <Toggle checked={isActive} onChange={({ detail }) => setIsActive(detail.checked)} />
            </FormField>
            <FormField label="Linked account">
              <Select
                selectedOption={connection}
                onChange={({ detail }) => setConnection(detail.selectedOption)}
                options={accountOptions}
              />
            </FormField>
          </ColumnLayout>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save changes
          </Button>
        </SpaceBetween>
      </Container>
      <TelemetryChart deviceId={device.id} deviceType={device.type} />
      <ConfirmationModal
        visible={deleteOpen}
        onDismiss={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        header="Delete device"
        loading={deleting}
        error={deleteError}
      >
        Delete {device.serialNo}? This is a soft delete — the record and its telemetry/invoice history are kept
        for audit purposes, but the device stops accepting new telemetry and disappears from active lists.
      </ConfirmationModal>
    </SpaceBetween>
  );
}
