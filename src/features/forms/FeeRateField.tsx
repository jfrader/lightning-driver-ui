import { Button, Flex, Pill, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { feeEstimatesQueryOptions } from '../../api/node-queries';
import type { AmountBounds, FeeEstimates } from '../../api/types';
import { ExactNumberField } from '../../components/ExactNumberField';
import { wrappingControlText } from '../../components/control-styles';
import { formatInteger, isWithin, parseWireDecimal } from '../../lib/money';
import { formatClockTime } from '../../lib/time';
import { useControlSize } from '../shell/use-shell-layout';

const ESTIMATES = [
  { key: 'economy', label: 'Economy' },
  { key: 'normal', label: 'Normal' },
  { key: 'priority', label: 'Priority' },
] as const satisfies readonly { key: keyof FeeEstimates; label: string }[];

const Muted = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

interface FeeRateFieldProps {
  nodeId: string;
  value: string;
  onChange: (value: string) => void;
  bounds: AmountBounds;
  error?: string;
}

/**
 * Whole sat/vB rate (§7.9). The node's estimates only fill the field; the field stays editable and
 * the rate is a request, not a fee quote. Estimates outside this node's limits cannot be picked.
 */
export function FeeRateField({ nodeId, value, onChange, bounds, error }: FeeRateFieldProps) {
  const size = useControlSize();
  const estimates = useQuery(feeEstimatesQueryOptions(nodeId));
  const reported = estimates.data ? ESTIMATES.filter(({ key }) => estimates.data[key] !== null) : [];
  return (
    <Flex direction="column" gap="sm">
      {estimates.data && reported.length > 0 && (
        <Flex wrap gap="sm" align="center">
          {reported.map(({ key, label }) => {
            const estimate = estimates.data[key];
            if (!estimate) return null;
            const allowed = isWithin(parseWireDecimal(estimate.fee_rate_sat_vbyte), bounds);
            const blocks = estimate.target_blocks === null ? '' : ` · ~${formatInteger(BigInt(estimate.target_blocks))} blocks`;
            return (
              <Button
                key={key}
                size={size}
                variant="outline"
                sx={wrappingControlText(size)}
                disabled={!allowed}
                title={allowed ? undefined : "Outside this node's fee-rate limits."}
                onClick={() => onChange(estimate.fee_rate_sat_vbyte)}
              >
                {`${label} ${estimate.fee_rate_sat_vbyte} sat/vB${blocks}`}
              </Button>
            );
          })}
        </Flex>
      )}
      {estimates.data && (
        <Flex wrap gap="sm" align="center">
          {estimates.data.stale && <Pill tone="warning">Stale</Pill>}
          <Muted>
            {reported.length === 0
              ? 'No fee estimates reported.'
              : estimates.data.observed_at === null
                ? 'Estimate time not reported'
                : `Estimated ${formatClockTime(estimates.data.observed_at) ?? estimates.data.observed_at} UTC`}
          </Muted>
          {reported.some(({ key }) => {
            const estimate = estimates.data[key];
            return estimate !== null && !isWithin(parseWireDecimal(estimate.fee_rate_sat_vbyte), bounds);
          }) && <Muted>Outside this node's fee-rate limits: disabled.</Muted>}
        </Flex>
      )}
      {estimates.isError && <Muted>No fee estimates reported.</Muted>}
      <ExactNumberField
        kind="whole"
        label="Fee rate (sat/vB)"
        value={value}
        onValueChange={onChange}
        description={`Allowed: ${bounds.min}–${bounds.max} sat/vB`}
        error={error}
        required
      />
    </Flex>
  );
}
