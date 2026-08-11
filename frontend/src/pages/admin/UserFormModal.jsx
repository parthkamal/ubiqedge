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
import { RoleType } from '../../constants/enums';

// mirrors backend's CreateUserDto/UpdateUserDto validation exactly — see
// backend/src/user/dto/{create,update}-user.dto.ts
const phonePattern = /^[0-9]{7,15}$/;
const pincodePattern = /^[0-9]{4,10}$/;

const baseShape = {
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phoneNumber: z.string().regex(phonePattern, 'Must be 7-15 digits'),
  address: z.string().min(1, 'Address is required'),
  pincode: z.string().regex(pincodePattern, 'Must be 4-10 digits'),
};

const createSchema = z.object({
  ...baseShape,
  email: z.string().email('Must be a valid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
  roleType: z.enum([RoleType.ADMIN, RoleType.CUSTOMER]),
});

const editSchema = z.object(baseShape);

const roleOptions = [
  { label: 'Admin', value: RoleType.ADMIN },
  { label: 'Customer', value: RoleType.CUSTOMER },
];

export default function UserFormModal({ visible, onDismiss, onSubmit, user, submitting, error }) {
  const isEdit = Boolean(user);
  const schema = isEdit ? editSchema : createSchema;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phoneNumber: '',
      address: '',
      pincode: '',
      roleType: RoleType.CUSTOMER,
    },
  });

  useEffect(() => {
    if (visible) {
      reset(
        user
          ? {
              firstName: user.firstName,
              lastName: user.lastName ?? '',
              phoneNumber: user.phoneNumber,
              address: user.address,
              pincode: user.pincode,
            }
          : {
              firstName: '',
              lastName: '',
              email: '',
              password: '',
              phoneNumber: '',
              address: '',
              pincode: '',
              roleType: RoleType.CUSTOMER,
            },
      );
    }
  }, [visible, user, reset]);

  function submit(values) {
    onSubmit(values);
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss} header={isEdit ? 'Edit user' : 'Create user'} size="medium">
      <form onSubmit={handleSubmit(submit)}>
        <Form
          errorText={error}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={onDismiss}>
                Cancel
              </Button>
              <Button variant="primary" loading={submitting} formAction="submit">
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {error && <Alert type="error">{error}</Alert>}
            <FormField label="First name" errorText={errors.firstName?.message}>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => <Input value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />}
              />
            </FormField>
            <FormField label="Last name" errorText={errors.lastName?.message}>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => <Input value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />}
              />
            </FormField>
            {!isEdit && (
              <>
                <FormField label="Email" errorText={errors.email?.message}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <Input type="email" value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />
                    )}
                  />
                </FormField>
                <FormField label="Password" errorText={errors.password?.message}>
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <Input type="password" value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />
                    )}
                  />
                </FormField>
                <FormField label="Role" errorText={errors.roleType?.message}>
                  <Controller
                    name="roleType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        selectedOption={roleOptions.find((o) => o.value === field.value) ?? null}
                        onChange={({ detail }) => field.onChange(detail.selectedOption.value)}
                        options={roleOptions}
                      />
                    )}
                  />
                </FormField>
              </>
            )}
            <FormField label="Phone number" errorText={errors.phoneNumber?.message}>
              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => <Input value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />}
              />
            </FormField>
            <FormField label="Address" errorText={errors.address?.message}>
              <Controller
                name="address"
                control={control}
                render={({ field }) => <Input value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />}
              />
            </FormField>
            <FormField label="Pincode" errorText={errors.pincode?.message}>
              <Controller
                name="pincode"
                control={control}
                render={({ field }) => <Input value={field.value} onChange={({ detail }) => field.onChange(detail.value)} />}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
