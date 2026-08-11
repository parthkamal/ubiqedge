import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@cloudscape-design/components/modal';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Alert from '@cloudscape-design/components/alert';
import { DeviceType } from '../../constants/enums';

// mirrors backend's CreateDeviceDto — connectionId deliberately omitted
// here: devices are created into inventory unassigned, then linked to an
// account later from the device detail page (see backend comment on
// CreateDeviceDto.connectionId)
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum([DeviceType.METER, DeviceType.TANK]),
});

const typeOptions = [
  { label: 'Meter', value: DeviceType.METER },
  { label: 'Tank', value: DeviceType.TANK },
];

export default function DeviceFormModal({ visible, onDismiss, onSubmit, submitting, error }) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: DeviceType.METER },
  });

  useEffect(() => {
    if (visible) reset({ name: '', type: DeviceType.METER });
  }, [visible, reset]);

  return (
    <Modal visible={visible} onDismiss={onDismiss} header="Create device" size="medium">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Form
          errorText={error}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={onDismiss}>
                Cancel
              </Button>
              <Button variant="primary" loading={submitting} formAction="submit">
                Create
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {error && <Alert type="error">{error}</Alert>}
            <FormField label="Name" errorText={errors.name?.message}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => <Input value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />}
              />
            </FormField>
            <FormField label="Type" errorText={errors.type?.message} description="Cannot be changed after creation">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    selectedOption={typeOptions.find((o) => o.value === field.value) ?? null}
                    onChange={({ detail }) => field.onChange(detail.selectedOption.value)}
                    options={typeOptions}
                  />
                )}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
