import { useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
import Box from '@cloudscape-design/components/box';
import { DeviceType, RateType } from '../../constants/enums';

// shape mirrors backend's CreatePricingConfigDto/CreatePricingSlabDto —
// the deeper slab-contiguity business rule (starts at 0, no gaps, only
// last unbounded) is validated server-side; this only checks types/shape,
// see PricingService.validateSlabStructure for the authoritative rule
const slabItemSchema = z.object({
  slabFrom: z.coerce.number().min(0, 'Must be >= 0'),
  slabTo: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
  rate: z.coerce.number().positive('Must be positive'),
});

const schema = z
  .object({
    type: z.enum([DeviceType.METER, DeviceType.TANK]),
    rateType: z.enum([RateType.FIXED, RateType.SLAB]),
    fixedRate: z.coerce.number().positive('Must be positive').optional(),
    // kept loose here on purpose — the placeholder slab row lives in
    // defaultValues regardless of rateType (react-hook-form's useFieldArray
    // needs it to exist even while the Slabs UI is hidden), so it must not
    // be shape-validated unless rateType is actually SLAB (see superRefine)
    slabs: z.array(z.any()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rateType === RateType.FIXED && data.fixedRate === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fixed rate is required', path: ['fixedRate'] });
      return;
    }
    if (data.rateType === RateType.SLAB) {
      if (!data.slabs || data.slabs.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one slab is required', path: ['slabs'] });
        return;
      }
      data.slabs.forEach((slab, index) => {
        const result = slabItemSchema.safeParse(slab);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ ...issue, path: ['slabs', index, ...issue.path] });
          }
        }
      });
    }
  })
  // superRefine only validates — it doesn't transform. Without this, a
  // passing SLAB submission would still hand submit() the raw (string)
  // Cloudscape Input values instead of the coerced numbers slabItemSchema
  // already proved parse cleanly above.
  .transform((data) =>
    data.rateType === RateType.SLAB && data.slabs
      ? { ...data, slabs: data.slabs.map((slab) => slabItemSchema.parse(slab)) }
      : data,
  );

const typeOptions = [
  { label: 'Meter', value: DeviceType.METER },
  { label: 'Tank', value: DeviceType.TANK },
];

const rateTypeOptions = [
  { label: 'Fixed', value: RateType.FIXED },
  { label: 'Slab (tiered)', value: RateType.SLAB },
];

export default function PricingFormModal({ visible, onDismiss, onSubmit, submitting, error }) {
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: DeviceType.METER,
      rateType: RateType.FIXED,
      fixedRate: undefined,
      slabs: [{ slabFrom: 0, slabTo: '', rate: undefined }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'slabs' });
  const rateType = watch('rateType');

  useEffect(() => {
    if (visible) {
      reset({
        type: DeviceType.METER,
        rateType: RateType.FIXED,
        fixedRate: undefined,
        slabs: [{ slabFrom: 0, slabTo: '', rate: undefined }],
      });
    }
  }, [visible, reset]);

  function submit(values) {
    const body = {
      type: values.type,
      rateType: values.rateType,
      ...(values.rateType === RateType.FIXED
        ? { fixedRate: values.fixedRate }
        : {
            slabs: values.slabs.map((s) => ({
              slabFrom: s.slabFrom,
              rate: s.rate,
              ...(s.slabTo !== '' && s.slabTo !== undefined ? { slabTo: s.slabTo } : {}),
            })),
          }),
    };
    onSubmit(body);
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss} header="Create pricing config" size="large">
      <form onSubmit={handleSubmit(submit)}>
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
            <Alert type="info">Creating a new config for a device type auto-closes its current active config.</Alert>
            <FormField label="Device type" errorText={errors.type?.message}>
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
            <FormField label="Rate type" errorText={errors.rateType?.message}>
              <Controller
                name="rateType"
                control={control}
                render={({ field }) => (
                  <Select
                    selectedOption={rateTypeOptions.find((o) => o.value === field.value) ?? null}
                    onChange={({ detail }) => field.onChange(detail.selectedOption.value)}
                    options={rateTypeOptions}
                  />
                )}
              />
            </FormField>

            {rateType === RateType.FIXED && (
              <FormField label="Rate per unit" errorText={errors.fixedRate?.message}>
                <Controller
                  name="fixedRate"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      value={field.value ?? ''}
                      onChange={({ detail }) => field.onChange(detail.value)}
                    />
                  )}
                />
              </FormField>
            )}

            {rateType === RateType.SLAB && (
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">
                  Slabs — first must start at 0, each must be contiguous, only the last may be unbounded
                </Box>
                {errors.slabs?.message && <Alert type="error">{errors.slabs.message}</Alert>}
                {fields.map((field, index) => (
                  <SpaceBetween key={field.id} direction="horizontal" size="xs">
                    <FormField label="From" errorText={errors.slabs?.[index]?.slabFrom?.message}>
                      <Controller
                        name={`slabs.${index}.slabFrom`}
                        control={control}
                        render={({ field: f }) => (
                          <Input type="number" value={f.value ?? ''} onChange={({ detail }) => f.onChange(detail.value)} />
                        )}
                      />
                    </FormField>
                    <FormField label="To (blank = unbounded)" errorText={errors.slabs?.[index]?.slabTo?.message}>
                      <Controller
                        name={`slabs.${index}.slabTo`}
                        control={control}
                        render={({ field: f }) => (
                          <Input type="number" value={f.value ?? ''} onChange={({ detail }) => f.onChange(detail.value)} />
                        )}
                      />
                    </FormField>
                    <FormField label="Rate" errorText={errors.slabs?.[index]?.rate?.message}>
                      <Controller
                        name={`slabs.${index}.rate`}
                        control={control}
                        render={({ field: f }) => (
                          <Input type="number" value={f.value ?? ''} onChange={({ detail }) => f.onChange(detail.value)} />
                        )}
                      />
                    </FormField>
                    <Box padding={{ top: 'xl' }}>
                      <Button
                        formAction="none"
                        variant="icon"
                        iconName="close"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      />
                    </Box>
                  </SpaceBetween>
                ))}
                <Button formAction="none" onClick={() => append({ slabFrom: '', slabTo: '', rate: '' })}>
                  Add slab
                </Button>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
