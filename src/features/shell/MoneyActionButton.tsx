import { Button, type ButtonProps } from '@jfrader/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useRouter } from '@tanstack/react-router';
import { MONEY_ACTIONS, type MoneyAction } from '../../app/search';
import { wrappingControlText } from '../../components/control-styles';
import { prefetchOperationForm } from '../forms/prefetch-operation-form';
import { useCurrentNode } from '../nodes/use-current-node';
import { useMoneySheet } from './use-money-sheet';

export function MoneyActionButton({ action, ...props }: Omit<ButtonProps, 'onClick' | 'sx'> & { action: MoneyAction }) {
  const sheet = useMoneySheet();
  const node = useCurrentNode();
  const queryClient = useQueryClient();
  const location = useLocation();
  const router = useRouter();
  const mode = MONEY_ACTIONS.send.some(candidate => candidate === action) ? 'send' : 'receive';
  return <Button {...props} sx={wrappingControlText(props.size)} onClick={async () => {
    await prefetchOperationForm(queryClient, node.id, action);
    if (router.state.location.href === location.href) sheet.update({ [mode]: 1, action }, false);
  }} />;
}
