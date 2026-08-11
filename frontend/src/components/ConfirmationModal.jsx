import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';

// shared by every destructive confirm-before-acting flow (user/device soft
// delete, and any future one) — one place for the "are you sure" shape
export default function ConfirmationModal({
  visible,
  onDismiss,
  onConfirm,
  header,
  children,
  confirmText = 'Delete',
  loading,
  error,
}) {
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={header}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={loading} onClick={onConfirm}>
              {confirmText}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="s">
        {error && <Alert type="error">{error}</Alert>}
        {children}
      </SpaceBetween>
    </Modal>
  );
}
