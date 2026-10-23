import { CopyButton, styled } from '@jfrader/ui';
import { useControlSize } from '../shell/use-shell-layout';

const GROUP_SIZE = 6;
const GROUPS = new RegExp(`.{1,${GROUP_SIZE}}`, 'g');

const Row = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.space[2],
  minInlineSize: 0,
}));

const Groups = styled.span<{ prominent: boolean }>(({ theme, prominent }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: '0.6ch',
  rowGap: theme.space[1],
  flex: 1,
  minInlineSize: 0,
  fontFamily: theme.font.mono,
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
  const size = useControlSize();
  return (
    <Row>
      <Groups prominent={prominent} title={value}>
        {identifierText(value, grouped, truncated)}
      </Groups>
      <CopyButton
        iconOnly
        variant="ghost"
        size={size}
        text={value}
        label={`Copy ${label.toLowerCase()}`}
        pendingLabel="Copying"
        copiedLabel={`${label} copied`}
        errorLabel="Copy failed"
        sx={{ flexShrink: 0 }}
      />
    </Row>
  );
}

const Short = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.textSize.sm,
  color: theme.color.textMuted,
  whiteSpace: 'nowrap',
}));

const SHORT_HEAD = 8;
const SHORT_TAIL = 6;

function shortForm(value: string): string {
  return value.length > SHORT_HEAD + SHORT_TAIL ? `${value.slice(0, SHORT_HEAD)}…${value.slice(-SHORT_TAIL)}` : value;
}

/** List-cell form of an identifier: head…tail, full value in the title. Copy lives in the inspector. */
export function ShortIdentifier({ value }: { value: string }) {
  return <Short title={value}>{shortForm(value)}</Short>;
}
