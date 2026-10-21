import type { ReactNode } from 'react';
import { WorkLayout } from './WorkLayout';

interface InspectorLayoutProps {
  list: ReactNode;
  /** The selected record's inspector, or `null` when nothing is selected. */
  inspector: ReactNode | null;
  inspectorLabel: string;
}

/** A resource list with its inspector: beside it from 80rem, below it otherwise, and absent when nothing is selected. */
export function InspectorLayout({ list, inspector, inspectorLabel }: InspectorLayoutProps) {
  if (inspector === null) return list;
  return <WorkLayout main={list} aside={inspector} asideLabel={inspectorLabel} />;
}
