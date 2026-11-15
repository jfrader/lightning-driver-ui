import { wireToMsat } from '../../lib/money';
import { Mono } from '../../components/text';
import { formatRatio } from '../../lib/ratio';
import { NotReported } from './NotReported';

interface FeeRatioProps {
  feeMsat: string | null;
  amountMsat: string | null;
  /** The fee is a cap, not a paid fee: reads "at most N% of amount". */
  cap?: boolean;
}

/** Fee over amount, rounded for display only; both exact operands stay on screen beside it. */
export function FeeRatio({ feeMsat, amountMsat, cap = false }: FeeRatioProps) {
  if (feeMsat === null || amountMsat === null) return <NotReported />;
  const ratio = formatRatio(wireToMsat(feeMsat, 'msat'), wireToMsat(amountMsat, 'msat'));
  if (ratio === null) return <NotReported>Not applicable</NotReported>;
  return <Mono wrap muted>{cap ? `at most ${ratio} of amount` : ratio}</Mono>;
}
