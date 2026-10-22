import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

// Popover menu used for dropdowns, "⋯" row menus and the "Acting as" switcher.
// Rendered in a portal with fixed positioning so tables/cards can't clip it.
// `trigger` is a render function: ({ open, toggle, ref }) => element.
// items: [{ key, label, sub, icon, selected, danger, disabled, onSelect }] or { divider: true }
// width: number (px) or '100%' to match the trigger.
export function Menu({ trigger, items, align = 'left', placement = 'bottom', width, className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const next = {};
    if (placement === 'top') next.bottom = window.innerHeight - r.top + 6;
    else next.top = r.bottom + 6;
    if (align === 'right') next.right = window.innerWidth - r.right;
    else next.left = r.left;
    if (width === '100%') next.width = r.width;
    else if (width) next.width = width;
    setPos(next);
  }, [open, align, placement, width]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && pos) menuRef.current?.querySelector('.menu-item:not(:disabled)')?.focus();
  }, [open, pos]);

  function onMenuKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...menuRef.current.querySelectorAll('.menu-item:not(:disabled)')];
    const i = list.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[next]?.focus();
  }

  return (
    <div className={`menu-root ${className}`} ref={rootRef}>
      {trigger({
        open,
        toggle: () => {
          setPos(null);
          setOpen((o) => !o);
        },
        ref: triggerRef,
      })}
      {open &&
        pos &&
        createPortal(
          <div ref={menuRef} className="menu" role="menu" style={pos} onKeyDown={onMenuKey}>
            {items.map((item, i) =>
              item.divider ? (
                <div key={`d${i}`} className="menu-divider" role="separator" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`menu-item${item.selected ? ' is-selected' : ''}${item.danger ? ' is-danger' : ''}`}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                    item.onSelect?.();
                  }}
                >
                  {item.icon && <span className="menu-item-icon">{item.icon}</span>}
                  <span className="menu-item-text">
                    <span>{item.label}</span>
                    {item.sub && <span className="menu-item-sub">{item.sub}</span>}
                  </span>
                  {item.selected && <Check className="menu-check" aria-hidden />}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
