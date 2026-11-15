import { styled } from '@jfrader/ui';
import { CopyAction } from '../../components/CopyValue';
import { Mono } from '../../components/text';

const GROUP_SIZE = 6;
const GROUPS = new RegExp(`.{1,${GROUP_SIZE}}`, 'g');

const Row = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.space[2],
  minInlineSize: 0,
}));

/** The value in 6-character groups: the machine rule, then the wrap and emphasis it needs. */
const Groups = styled(Mono)<{ prominent: boolean }>(({ theme, prominent }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: '0.6ch',
  rowGap: theme.space[1],
  flex: 1,
  minInlineSize: 0,
  fontSize: prominent ? theme.textSize.md : theme.textSize.sm,
  color: prominent ? theme.color.text : theme.color.textMuted,
}));

const Whole = styled.span({ overflowWrap: 'anywhere', minInlineSize: 0 });

interface IdentifierProps {
  value: string;
  /** Names the value for the copy button, e.g. "Recipient node". */
  label: string;
  prominent?: boolean;
  /** Group hex keys, hashes and addresses; a value with its own structure (`host:port`) stays whole. */
  grouped?: boolean;
  /** Show head…tail only (full value in the title); copy still takes the whole value. */
  truncated?: boolean;
}

function identifierText(value: string, grouped: boolean, truncated: boolean) {
  if (truncated) return <Whole>{shortForm(value)}</Whole>;
  if (!grouped) return <Whole>{value}</Whole>;
  return (value.match(GROUPS) ?? []).map((group, index) => <span key={index}>{group}</span>);
}

/**
 * A full identifier in 6-character groups that wrap only between groups, with a copy button.
 * The groups are adjacent spans, so selecting the text still copies the exact string.
 */
export function Identifier({ value, label, prominent = false, grouped = true, truncated = false }: IdentifierProps) {
  return (
    <Row>
      <Groups prominent={prominent} title={value}>
        {identifierText(value, grouped, truncated)}
      </Groups>
      <CopyAction value={value} label={label.toLowerCase()} variant="ghost" copiedLabel={`${label} copied`} />
    </Row>
  );
}

/** A list cell must not wrap, whatever the width. */
const Short = styled(Mono)({ whiteSpace: 'nowrap' });

const SHORT_HEAD = 8;
const SHORT_TAIL = 6;

function shortForm(value: string): string {
  return value.length > SHORT_HEAD + SHORT_TAIL ? `${value.slice(0, SHORT_HEAD)}…${value.slice(-SHORT_TAIL)}` : value;
}

/** List-cell form of an identifier: head…tail, full value in the title. Copy lives in the inspector. */
export function ShortIdentifier({ value }: { value: string }) {
  return <Short muted size="sm" title={value}>{shortForm(value)}</Short>;
}
