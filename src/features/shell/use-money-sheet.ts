import { useContext } from 'react';
import { useLocation, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import type { MoneySearch } from '../../app/search';
import { MoneySheetContext } from './money-sheet-context';

declare module '@tanstack/react-router' {
  interface HistoryState {
    moneySheet?: boolean;
  }
}

export function useMoneySheet() {
  const entered = useContext(MoneySheetContext);
  if (!entered) throw new Error('MoneySheetContext is required');
  const search = useSearch({ strict: false });
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const open = !!(search.send || search.receive || search.operation);
  const update = (next: MoneySearch, replace = true) => {
    if (!replace) entered.current = 'opened';
    void navigate({
      to: '.',
      search: (previous) => ({ ...previous, send: undefined, receive: undefined, operation: undefined, action: undefined, confirmation: undefined, ...next }),
      state: (previous) => ({ ...previous, moneySheet: replace ? (next.send || next.receive || next.operation ? previous.moneySheet : undefined) : true }),
      hash: location.hash,
      replace,
      resetScroll: false,
    });
  };
  const close = () => {
    if (!open || entered.current === 'closing') return;
    if (entered.current === 'opened' && location.state.moneySheet) {
      entered.current = 'closing';
      router.history.back();
    }
    else update({});
  };
  return { search, update, close };
}
