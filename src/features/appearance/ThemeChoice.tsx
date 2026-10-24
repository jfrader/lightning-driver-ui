import { SegmentedControl } from '@jfrader/ui';
import { isKeyOf, keysOf } from '../../lib/guards';
import { useControlSize } from '../shell/use-shell-layout';
import { useAppearance } from './appearance-context';
import { THEME_PREFERENCE_LABEL } from './theme-preference';

const OPTIONS = keysOf(THEME_PREFERENCE_LABEL).map((value) => ({ value, label: THEME_PREFERENCE_LABEL[value] }));

export function ThemeChoice() {
  const { preference, setPreference } = useAppearance();
  return (
    <SegmentedControl
      label="Theme"
      size={useControlSize()}
      options={OPTIONS}
      value={preference}
      sx={{ minInlineSize: 0, maxInlineSize: '100%' }}
      slotProps={{ track: { sx: { flexWrap: 'wrap' } } }}
      onValueChange={(value) => {
        if (isKeyOf(THEME_PREFERENCE_LABEL, value)) setPreference(value);
      }}
    />
  );
}
