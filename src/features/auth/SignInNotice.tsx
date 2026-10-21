import { Alert } from '@jfrader/ui';
import { ErrorNotice } from '../../components/ErrorNotice';
import { HostInstruction } from './HostInstruction';
import { SIGN_IN_COPY, rateLimitedText, type SignInProblem } from './sign-in-problem';

/** The literal §6.3 sentence for a sign-in or enrollment failure; anything unlisted is the §9.2 block. */
export function SignInNotice({ problem }: { problem: SignInProblem }) {
  switch (problem.kind) {
    case 'text':
      return <Alert tone={problem.tone}>{problem.text}</Alert>;
    case 'rate_limited':
      return <Alert tone="warning">{rateLimitedText(problem.seconds)}</Alert>;
    case 'enrollment_disabled':
      return (
        <Alert tone="warning" title={SIGN_IN_COPY.enrollmentDisabled}>
          <HostInstruction ending=" for a new token." />
        </Alert>
      );
    case 'server':
      return <ErrorNotice error={problem.error} />;
  }
}
