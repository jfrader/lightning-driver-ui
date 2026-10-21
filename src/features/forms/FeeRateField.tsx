import { Button, Flex, styled } from '@jfrader/ui';
import { ExactNumberField } from '../../components/ExactNumberField';
import { useQuery } from '@tanstack/react-query';
import { feeEstimatesQueryOptions } from '../../api/node-queries';
import type { AmountBounds, FeeEstimates } from '../../api/types';
import { Freshness } from '../../components/Freshness';

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

/** Whole sat/vB rate. Node estimates only fill the field; the rate is a request, not a fee quote. */
export function FeeRateField({ nodeId, value, onChange, bounds, error }: FeeRateFieldProps) {
  const estimates = useQuery(feeEstimatesQueryOptions(nodeId));
  return (
    <Flex direction="column" gap="sm">
      <ExactNumberField
        kind="whole"
        label="Fee rate (sat/vB)"
        value={value}
        onValueChange={onChange}
        description={`Allowed: ${bounds.min}–${bounds.max} sat/vB`}
        error={error}
        required
      />
      {estimates.data && (
        <Flex wrap gap="sm" align="center">
          {ESTIMATES.map(({ key, label }) => {
            const estimate = estimates.data[key];
            if (!estimate) return null;
            const blocks = estimate.target_blocks === null ? '' : ` · ${estimate.target_blocks} blocks`;
            return (
              <Button key={key} size="sm" variant="outline" onClick={() => onChange(estimate.fee_rate_sat_vbyte)}>
                {`${label} ${estimate.fee_rate_sat_vbyte} sat/vB${blocks}`}
              </Button>
            );
          })}
          {ESTIMATES.every(({ key }) => estimates.data[key] === null) && <Muted>No fee estimates available.</Muted>}
          <Freshness observedAt={estimates.data.observed_at} stale={estimates.data.stale} />
        </Flex>
      )}
      {estimates.isError && <Muted>Fee estimates unavailable. Enter a rate.</Muted>}
    </Flex>
  );
}
