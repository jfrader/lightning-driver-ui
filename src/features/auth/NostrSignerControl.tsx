import { lazy, Suspense } from 'react';

const RemoteSignerControl = lazy(() => import('./RemoteSignerControl'));

export function NostrSignerControl(props: { disabled: boolean }) {
  return <Suspense><RemoteSignerControl {...props} /></Suspense>;
}
