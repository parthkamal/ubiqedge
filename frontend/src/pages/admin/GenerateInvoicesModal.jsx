import { useState } from 'react';
import Modal from '@cloudscape-design/components/modal';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import DatePicker from '@cloudscape-design/components/date-picker';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';

// per FR: admin-triggered only, never a background schedule — this modal
// is the entire trigger surface. Leaving both dates blank defaults to the
// previous calendar month (see backend GenerateInvoicesDto).
export default function GenerateInvoicesModal({ visible, onDismiss, onSubmit, submitting, error }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function handleSubmit() {
    onSubmit({
      billingPeriodStart: start || undefined,
      billingPeriodEnd: end || undefined,
    });
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss} header="Generate invoices" size="medium">
      <Form
        errorText={error}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} onClick={handleSubmit}>
              Generate
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          {error && <Alert type="error">{error}</Alert>}
          <Alert type="info">Leave both dates blank to generate for the previous calendar month.</Alert>
          <FormField label="Billing period start (optional)">
            <DatePicker value={start} onChange={({ detail }) => setStart(detail.value)} placeholder="YYYY/MM/DD" />
          </FormField>
          <FormField label="Billing period end (optional)">
            <DatePicker value={end} onChange={({ detail }) => setEnd(detail.value)} placeholder="YYYY/MM/DD" />
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
