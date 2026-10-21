import type { MouseEvent } from 'react';
import { Navigation, type NavigationGroupRecord } from '@jfrader/ui';
import { useRouter } from '@tanstack/react-router';

interface RouterNavigationProps {
  label: string;
  groups: readonly NavigationGroupRecord[];
  onNavigate?: () => void;
}

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** jfrader-ui Navigation whose in-app links go through the router instead of reloading. */
export function RouterNavigation({ label, groups, onNavigate }: RouterNavigationProps) {
  const router = useRouter();
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || !isPlainClick(event) || !(event.target instanceof Element)) return;
    const href = event.target.closest('a[href]')?.getAttribute('href');
    if (!href?.startsWith('/')) return;
    event.preventDefault();
    router.history.push(href);
    onNavigate?.();
  };
  return <Navigation label={label} groups={groups} onClick={handleClick} />;
}
