import { useState } from 'react';
import { copyText } from '../lib/browser';
import { pushToast } from '../lib/toast';
import { CheckIcon, CopyIcon } from './Icons';

interface CopyButtonProps {
  value: string | (() => Promise<string>);
  label?: string;
  successMessage?: string;
  className?: string;
  variant?: 'btn' | 'ghost' | 'icon';
  disabled?: boolean;
}

/** Copy-to-clipboard button with a real success/failure state. */
export function CopyButton({
  value,
  label = 'Copy',
  successMessage = 'Copied to clipboard',
  className = '',
  variant = 'btn',
  disabled = false,
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function run() {
    if (disabled || state === 'working') return;
    setState('working');
    try {
      const text = typeof value === 'function' ? await value() : value;
      const result = await copyText(text);
      if (result.ok) {
        setState('done');
        pushToast('success', successMessage);
        window.setTimeout(() => setState('idle'), 1600);
      } else {
        setState('error');
        pushToast('error', 'Copy failed', result.error);
        window.setTimeout(() => setState('idle'), 2600);
      }
    } catch (error) {
      setState('error');
      pushToast('error', 'Copy failed', error instanceof Error ? error.message : 'Unknown error');
      window.setTimeout(() => setState('idle'), 2600);
    }
  }

  const cls =
    variant === 'icon'
      ? `card__action ${className}`
      : variant === 'ghost'
        ? `btn btn--ghost btn--sm ${className}`
        : `btn btn--sm ${className}`;

  return (
    <button
      type="button"
      className={cls}
      onClick={run}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-state={state}
    >
      {state === 'done' ? <CheckIcon /> : <CopyIcon />}
      {variant !== 'icon' ? <span>{state === 'done' ? 'Copied' : label}</span> : null}
    </button>
  );
}
