import { EmptyState } from '@jfrader/ui';
import { ButtonLink } from '../../components/ButtonLink';

export function NodeNotFound() {
  return (
    <EmptyState
      title="Node not found"
      description="No configured node has this ID."
      action={<ButtonLink to="/fleet">Open fleet</ButtonLink>}
    />
  );
}
