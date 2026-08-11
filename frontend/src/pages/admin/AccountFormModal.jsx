import { useEffect, useState } from 'react';
import Modal from '@cloudscape-design/components/modal';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';
import { useUsers } from '../../hooks/useUsers';
import { RoleType } from '../../constants/enums';

// only Customer users can have an account (see backend AccountService.create)
export default function AccountFormModal({ visible, onDismiss, onSubmit, submitting, error }) {
  const { items: users, fetchList } = useUsers();
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (visible) {
      setSelectedUser(null);
      fetchList({ roleType: RoleType.CUSTOMER, limit: 100 });
    }
  }, [visible, fetchList]);

  const userOptions = users.map((u) => ({
    label: `${u.firstName} ${u.lastName ?? ''} (${u.email})`,
    value: u.id,
  }));

  function handleSubmit() {
    if (selectedUser) onSubmit({ userId: selectedUser.value });
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss} header="Create account" size="medium">
      <Form
        errorText={error}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} disabled={!selectedUser} onClick={handleSubmit}>
              Create
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          {error && <Alert type="error">{error}</Alert>}
          <FormField label="Customer" description="Only Customer-role users without an existing account can be linked">
            <Select
              selectedOption={selectedUser}
              onChange={({ detail }) => setSelectedUser(detail.selectedOption)}
              options={userOptions}
              filteringType="auto"
              placeholder="Choose a customer"
              empty="No Customer users found"
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
