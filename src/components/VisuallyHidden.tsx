import { styled } from '@jfrader/ui';
import { visuallyHidden } from './visually-hidden';

/** An inline label for assistive technology only; the style has one source in `visually-hidden`. */
export const VisuallyHidden = styled.span(visuallyHidden);
