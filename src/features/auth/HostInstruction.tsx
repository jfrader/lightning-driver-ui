import { styled } from '@jfrader/ui';
import { InlineCode } from '../../components/InlineCode';
import { ENROLLMENT_COMMAND } from './sign-in-problem';

const Line = styled.p({ margin: 0 });

/** A command line wraps only between its arguments, never inside one (`--config` stays whole). */
const Argument = styled.span({ whiteSpace: 'nowrap' });

/** `Run {command} on the host…`: the only recovery-adjacent copy the UI prints. */
export function HostInstruction({ ending }: { ending: string }) {
  const args = ENROLLMENT_COMMAND.split(' ');
  return (
    <Line>
      Run{' '}
      <InlineCode>
        {args.map((arg, index) => (
          <span key={index}>
            {index > 0 && ' '}
            <Argument>{arg}</Argument>
          </span>
        ))}
      </InlineCode>{' '}
      on the host{ending}
    </Line>
  );
}
