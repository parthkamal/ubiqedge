import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Select from '@cloudscape-design/components/select';
import DatePicker from '@cloudscape-design/components/date-picker';
import Box from '@cloudscape-design/components/box';
import Spinner from '@cloudscape-design/components/spinner';
import { useTelemetry } from '../hooks/useTelemetry';
import { DeviceType, ParamKey, TelemetryRangePreset } from '../constants/enums';

// the one chart in the app — everything else is tables/forms, per
// implementation spec §8. Fetches a single page (limit=500, the backend's
// max) — fine for this demo's data volumes; a production deployment with
// months of 5-min-cadence readings would need server-side downsampling,
// documented as a known limitation rather than built here.
const MAX_LIMIT = 500;

const paramOptionsByType = {
  [DeviceType.METER]: [
    { label: 'Total consumption', value: ParamKey.TOTAL },
    { label: 'Instantaneous flow', value: ParamKey.FLOW },
  ],
  [DeviceType.TANK]: [{ label: 'Tank level', value: ParamKey.LEVEL }],
};

const rangeSegments = [
  { text: '1 day', id: TelemetryRangePreset.DAY },
  { text: '7 days', id: TelemetryRangePreset.WEEK },
  { text: '30 days', id: TelemetryRangePreset.MONTH },
  { text: 'Custom', id: TelemetryRangePreset.CUSTOM },
];

function formatTimestamp(value) {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function TelemetryChart({ deviceId, deviceType }) {
  const { items, status, fetchForDevice } = useTelemetry();
  const paramOptions = paramOptionsByType[deviceType] ?? [];
  const [paramKey, setParamKey] = useState(paramOptions[0]);
  const [range, setRange] = useState(TelemetryRangePreset.DAY);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const isCustomReady = range !== TelemetryRangePreset.CUSTOM || (customFrom && customTo);

  useEffect(() => {
    if (!paramKey || !isCustomReady) return;
    fetchForDevice(deviceId, {
      range,
      from: range === TelemetryRangePreset.CUSTOM ? customFrom : undefined,
      to: range === TelemetryRangePreset.CUSTOM ? customTo : undefined,
      paramKey: paramKey.value,
      limit: MAX_LIMIT,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, range, customFrom, customTo, paramKey, fetchForDevice]);

  const chartData = useMemo(
    () => items.map((r) => ({ ...r, value: Number(r.value) })),
    [items],
  );

  return (
    <Container header={<Header variant="h2">Consumption</Header>}>
      <SpaceBetween size="l">
        <SpaceBetween direction="horizontal" size="l">
          <SegmentedControl
            selectedId={range}
            onChange={({ detail }) => setRange(detail.selectedId)}
            options={rangeSegments}
          />
          {paramOptions.length > 1 && (
            <Box>
              <Select
                selectedOption={paramKey}
                onChange={({ detail }) => setParamKey(detail.selectedOption)}
                options={paramOptions}
              />
            </Box>
          )}
        </SpaceBetween>
        {range === TelemetryRangePreset.CUSTOM && (
          <SpaceBetween direction="horizontal" size="l">
            <FormFieldDate label="From" value={customFrom} onChange={setCustomFrom} />
            <FormFieldDate label="To" value={customTo} onChange={setCustomTo} />
          </SpaceBetween>
        )}
        {status === 'loading' ? (
          <Box textAlign="center" padding="xxl">
            <Spinner size="large" />
          </Box>
        ) : chartData.length === 0 ? (
          <Box textAlign="center" color="text-body-secondary" padding="xxl">
            No telemetry data in this range
          </Box>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="deviceTimestamp" tickFormatter={formatTimestamp} minTickGap={40} />
                <YAxis />
                <Tooltip labelFormatter={formatTimestamp} />
                <Line type="monotone" dataKey="value" stroke="#0972d3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SpaceBetween>
    </Container>
  );
}

function FormFieldDate({ label, value, onChange }) {
  return (
    <Box>
      <Box variant="awsui-key-label">{label}</Box>
      <DatePicker value={value} onChange={({ detail }) => onChange(detail.value)} placeholder="YYYY/MM/DD" />
    </Box>
  );
}
