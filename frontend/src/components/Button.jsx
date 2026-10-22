import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

// variant: 'primary' | 'secondary' | 'danger' | 'ghost'; size: 'md' | 'sm' | 'icon'
export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading = false, block = false, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', `btn-${variant}`, size === 'icon' ? 'btn-icon-only' : `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="btn-glyph spin" aria-hidden /> : Icon && <Icon className="btn-glyph" aria-hidden />}
      {children}
    </button>
  );
});
