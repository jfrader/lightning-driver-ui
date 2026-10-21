import { REMEMBERED_NODE_STORAGE_KEY } from '../../config';

const NODE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isNodeId(value: unknown): value is string {
  return typeof value === 'string' && NODE_ID_PATTERN.test(value);
}

/** The last opened node ID. Storage holds nothing else: no node data, amounts or credentials. */
export function readRememberedNodeId(): string | null {
  try {
    const value = window.localStorage.getItem(REMEMBERED_NODE_STORAGE_KEY);
    return isNodeId(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberNodeId(nodeId: string): void {
  try {
    window.localStorage.setItem(REMEMBERED_NODE_STORAGE_KEY, nodeId);
  } catch {
    // Storage can be unavailable (private mode, quota); landing then shows the node list.
  }
}

export function forgetRememberedNodeId(): void {
  try {
    window.localStorage.removeItem(REMEMBERED_NODE_STORAGE_KEY);
  } catch {
    // See rememberNodeId.
  }
}
