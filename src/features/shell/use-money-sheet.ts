import { useLocation, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import type { MoneySearch } from '../../app/search';

declare module '@tanstack/react-router' {
  interface HistoryState {
    moneySheet?: boolean;
  }
}

export function useMoneySheet() {
  const search = useSearch({ strict: false });
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const update = (next: MoneySearch, replace = true) =>
    void navigate({
      to: '.',
      search: (previous) => ({ ...previous, send: undefined, receive: undefined, operation: undefined, action: undefined, confirmation: undefined, ...next }),
      state: { moneySheet: replace ? location.state.moneySheet : true },
      hash: location.hash,
      replace,
      resetScroll: false,
    });
  const close = () => {
    if (location.state.moneySheet) router.history.back();
    else update({});
  };
  return { search, update, close };
}
