import { EmptyState } from '@jfrader/ui';
import { ButtonLink } from '../../components/ButtonLink';
import { useControlSize } from '../shell/use-shell-layout';

export function NodeNotFound() {
  const size = useControlSize();
  return (
    <EmptyState
      title="Node not found"
      description="No configured node has this ID."
      action={<ButtonLink to="/fleet" size={size}>Open fleet</ButtonLink>}
    />
  );
}
