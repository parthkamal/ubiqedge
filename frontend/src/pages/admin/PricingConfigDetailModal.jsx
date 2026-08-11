import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import { RateType } from '../../constants/enums';

function Field({ label, children }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function PricingConfigDetailModal({ visible, onDismiss, config }) {
  if (!config) return null;
  const isActive = config.effectiveTo === null;

  return (
    <Modal visible={visible} onDismiss={onDismiss} header={`${config.type} pricing config`} size="medium">
      <SpaceBetween size="l">
        <ColumnLayout columns={2} variant="text-grid">
          <Field label="Device type">{config.type}</Field>
          <Field label="Rate type">{config.rateType}</Field>
          <Field label="Status">
            <StatusIndicator type={isActive ? 'success' : 'stopped'}>
              {isActive ? 'Active' : 'Superseded'}
            </StatusIndicator>
          </Field>
          <Field label="Effective from">{new Date(config.effectiveFrom).toLocaleString()}</Field>
          <Field label="Effective to">
            {config.effectiveTo ? new Date(config.effectiveTo).toLocaleString() : '— (current)'}
          </Field>
          <Field label="Created">{new Date(config.createdAt).toLocaleString()}</Field>
        </ColumnLayout>

        {config.rateType === RateType.FIXED ? (
          <Field label="Rate per unit">{config.fixedRate}</Field>
        ) : (
          <Table
            header={<Box variant="awsui-key-label">Slab tiers</Box>}
            columnDefinitions={[
              { id: 'slabFrom', header: 'From', cell: (s) => s.slabFrom },
              { id: 'slabTo', header: 'To', cell: (s) => s.slabTo ?? '∞ (unbounded)' },
              { id: 'rate', header: 'Rate per unit', cell: (s) => s.rate },
            ]}
            items={[...config.slabs].sort((a, b) => Number(a.slabFrom) - Number(b.slabFrom))}
            trackBy="slabFrom"
          />
        )}
      </SpaceBetween>
    </Modal>
  );
}
