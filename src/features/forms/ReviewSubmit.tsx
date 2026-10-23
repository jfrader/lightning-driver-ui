import { Button, Flex } from '@jfrader/ui';
import { wrappingControlText } from '../../components/control-styles';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useControlSize } from '../shell/use-shell-layout';
import type { CreateField } from './create-errors';

interface ReviewSubmitProps {
  label: string;
  pending: boolean;
  error: unknown;
  nodeId: string;
  /** Fields the form shows, so their server errors stay on the field. */
  fields?: readonly CreateField[];
  tone?: 'accent' | 'danger';
}

/** The form's one submit: it creates a review and opens it; nothing is sent to the node from here. */
export function ReviewSubmit({ label, pending, error, nodeId, fields, tone = 'accent' }: ReviewSubmitProps) {
  const size = useControlSize();
  return (
    <Flex direction="column" gap="sm" align="start">
      <Button type="submit" tone={tone} variant="solid" size={size} loading={pending} sx={wrappingControlText(size)}>
        {label}
      </Button>
      <SubmitFeedback error={error} nodeId={nodeId} fields={fields} />
    </Flex>
  );
}
