import type { ReactNode } from 'react';
import { Accordion } from '@jfrader/ui';
import { TOUCH_TARGET } from '../config';

const TRIGGER = { trigger: { sx: { minBlockSize: TOUCH_TARGET } } };

interface DisclosureProps {
  value: string;
  label: string;
  children: ReactNode;
}

/** One collapsed section (technical details, node context) whose trigger is a full touch target. */
export function Disclosure({ value, label, children }: DisclosureProps) {
  return <Accordion collapsible items={[{ value, label, panel: children }]} slotProps={TRIGGER} />;
}
