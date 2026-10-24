import { createContext, type RefObject } from 'react';

export const OverlayInvokerContext = createContext<RefObject<HTMLElement | null> | null>(null);
