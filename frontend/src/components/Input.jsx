import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Label + control + hint/error, matching mockup 02.
export function Field({ label, optional, hint, error, children, id: idProp }) {
  const autoId = useId();
  const id = idProp || autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {optional && <span className="field-optional"> (optional)</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p className="field-error" id={`${id}-error`}>{error}</p>
      ) : (
        hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>
      )}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ mono, className = '', icon: Icon, ...rest }, ref) {
  if (Icon) {
    return (
      <span className={`input-wrap ${className}`}>
        <Icon className="input-lead" aria-hidden />
        <input ref={ref} className={`input input-has-lead${mono ? ' mono' : ''}`} {...rest} />
      </span>
    );
  }
  return <input ref={ref} className={`input${mono ? ' mono' : ''} ${className}`} {...rest} />;
});

// Masked input with an eye toggle. Never autocompletes or spellchecks.
export const SecretInput = forwardRef(function SecretInput({ className = '', ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={`input-wrap ${className}`}>
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className="input mono input-has-trail"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        {...rest}
      />
      <button
        type="button"
        className="input-trail"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </button>
    </span>
  );
});

export const TextArea = forwardRef(function TextArea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`input textarea ${className}`} {...rest} />;
});
