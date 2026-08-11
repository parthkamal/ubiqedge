import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Link from '@cloudscape-design/components/link';
import { useInvoices } from '../../hooks/useInvoices';
import { InvoiceStatus } from '../../constants/enums';

const statusIndicatorType = {
  [InvoiceStatus.PENDING]: 'pending',
  [InvoiceStatus.PAID]: 'success',
  [InvoiceStatus.CANCELLED]: 'stopped',
};

function Field({ label, children }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { current: invoice, status, fetchOne, cancel } = useInvoices();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOne(id);
  }, [id, fetchOne]);

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancel(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (status === 'loading' || !invoice || invoice.id !== Number(id)) {
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
          { text: 'Invoices', href: '/admin/invoices' },
          { text: invoice.serialNo, href: `/admin/invoices/${id}` },
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
              invoice.status !== InvoiceStatus.CANCELLED &&
              invoice.status !== InvoiceStatus.PAID && (
                <Button loading={cancelling} onClick={handleCancel}>
                  Cancel invoice
                </Button>
              )
            }
          >
            {invoice.serialNo}
          </Header>
        }
      >
        <SpaceBetween size="l">
          {error && <Alert type="error">{error}</Alert>}
          <ColumnLayout columns={3} variant="text-grid">
            <Field label="Status">
              <StatusIndicator type={statusIndicatorType[invoice.status]}>{invoice.status}</StatusIndicator>
            </Field>
            <Field label="Device">
              <Link onFollow={() => navigate(`/admin/devices/${invoice.device.id}`)}>
                {invoice.device.name} ({invoice.device.serialNo})
              </Link>
            </Field>
            <Field label="Billing period">
              {invoice.billingPeriodStart} – {invoice.billingPeriodEnd}
            </Field>
            <Field label="Opening reading">{invoice.openingReading}</Field>
            <Field label="Closing reading">{invoice.closingReading}</Field>
            <Field label="Consumption">{invoice.consumptionUnits}</Field>
            <Field label="Applied rate">{invoice.appliedUnitRate}</Field>
            <Field label="Amount">{invoice.amount}</Field>
            <Field label="Due date">{invoice.dueDate ?? '—'}</Field>
            <Field label="Generated at">{new Date(invoice.generatedAt).toLocaleString()}</Field>
            <Field label="Transaction provider">{invoice.transactionProvider ?? '—'}</Field>
            <Field label="Transaction ID">{invoice.transactionId ?? '—'}</Field>
          </ColumnLayout>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}
