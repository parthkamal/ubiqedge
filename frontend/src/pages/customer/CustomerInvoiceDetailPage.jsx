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
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import { useInvoices } from '../../hooks/useInvoices';
import { usePayments } from '../../hooks/usePayments';
import { InvoiceStatus, PaymentStatus } from '../../constants/enums';

const statusIndicatorType = {
  [InvoiceStatus.PENDING]: 'pending',
  [InvoiceStatus.PAID]: 'success',
  [InvoiceStatus.CANCELLED]: 'stopped',
};

const paymentStatusIndicatorType = {
  [PaymentStatus.INITIATED]: 'pending',
  [PaymentStatus.SUCCESS]: 'success',
  [PaymentStatus.FAILED]: 'error',
};

function Field({ label, children }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function CustomerInvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { current: invoice, status, fetchOne } = useInvoices();
  const { items: payments, initiate, fetchForInvoice } = usePayments();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    fetchOne(id);
    fetchForInvoice(id);
  }, [id, fetchOne, fetchForInvoice]);

  async function handlePay() {
    setPaying(true);
    setError(null);
    try {
      const result = await initiate(id);
      setSession(result);
      fetchForInvoice(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
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
          { text: 'My invoices', href: '/invoices' },
          { text: invoice.serialNo, href: `/invoices/${id}` },
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
              invoice.status === InvoiceStatus.PENDING && (
                <Button variant="primary" loading={paying} onClick={handlePay}>
                  Pay now
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
          {session && (
            <Alert type="info" header="Payment initiated">
              Transaction {session.providerTransactionId} via {session.provider}, amount {session.amount}.
              This is a mock gateway — no real checkout page exists; the invoice moves to PAID once the
              provider's webhook confirms success out-of-band.
            </Alert>
          )}
          <ColumnLayout columns={3} variant="text-grid">
            <Field label="Status">
              <StatusIndicator type={statusIndicatorType[invoice.status]}>{invoice.status}</StatusIndicator>
            </Field>
            <Field label="Device">
              <Link onFollow={() => navigate(`/account/devices/${invoice.device.id}`)}>{invoice.device.name}</Link>
            </Field>
            <Field label="Billing period">
              {invoice.billingPeriodStart} – {invoice.billingPeriodEnd}
            </Field>
            <Field label="Consumption">{invoice.consumptionUnits}</Field>
            <Field label="Applied rate">{invoice.appliedUnitRate}</Field>
            <Field label="Amount">{invoice.amount}</Field>
            <Field label="Due date">{invoice.dueDate ?? '—'}</Field>
            <Field label="Transaction provider">{invoice.transactionProvider ?? '—'}</Field>
            <Field label="Transaction ID">{invoice.transactionId ?? '—'}</Field>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      <Table
        header={<Header variant="h2">Payment attempts</Header>}
        columnDefinitions={[
          { id: 'providerTransactionId', header: 'Transaction ID', cell: (p) => p.providerTransactionId },
          { id: 'amount', header: 'Amount', cell: (p) => p.amount },
          {
            id: 'status',
            header: 'Status',
            cell: (p) => (
              <StatusIndicator type={paymentStatusIndicatorType[p.status]}>{p.status}</StatusIndicator>
            ),
          },
          { id: 'createdAt', header: 'Attempted at', cell: (p) => new Date(p.createdAt).toLocaleString() },
        ]}
        items={payments}
        trackBy="id"
        empty={
          <Box textAlign="center" color="inherit">
            No payment attempts yet
          </Box>
        }
      />
    </SpaceBetween>
  );
}
