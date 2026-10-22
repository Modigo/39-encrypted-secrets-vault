import { useState } from 'react';
import { Lock, RotateCw, Shield, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { Field, SecretInput, TextArea, TextInput } from './Input';
import { Modal } from './Modal';
import { useToast } from './Toast';

export const NAME_PATTERN = /^[A-Z0-9_]+$/;
const MAX_NAME = 100;
const MAX_VALUE = 10_000;

function validateValue(value) {
  if (!value) return 'Enter a value.';
  if (value.length > MAX_VALUE) return `Keep the value under ${MAX_VALUE.toLocaleString()} characters.`;
  return null;
}

export function validateSecretForm({ name, value }) {
  const errors = {};
  if (!name) errors.name = 'Enter a name.';
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters.`;
  else if (!NAME_PATTERN.test(name)) errors.name = 'Use uppercase letters, numbers and underscores only.';
  const valueError = validateValue(value);
  if (valueError) errors.value = valueError;
  return errors;
}

// Mockup 02. Value lives only in this component's state and is gone on close.
export function AddSecretModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', value: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const showDescription = api.capabilities.descriptions;

  function update(field, val) {
    const next = { ...form, [field]: val };
    setForm(next);
    if (submitted) setErrors(validateSecretForm(next));
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitted(true);
    const found = validateSecretForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const created = await api.createSecret({
        name: form.name,
        value: form.value,
        ...(showDescription && form.description.trim() ? { description: form.description.trim() } : {}),
      });
      toast.success(`${created.name} encrypted and saved`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      if (err.status === 409) setErrors({ name: err.message });
      else if (err.status !== 401) toast.error(`Couldn't save secret: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title="Add secret"
      subtitle="The value is encrypted on the server before it is stored."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Lock} loading={busy}>Encrypt &amp; save</Button>
        </>
      }
    >
      <Field label="Name" hint="Uppercase letters, numbers and underscores only." error={errors.name}>
        {(p) => (
          <TextInput
            {...p}
            mono
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="MAILGUN_API_KEY"
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_NAME + 1}
          />
        )}
      </Field>
      <Field label="Secret value" error={errors.value}>
        {(p) => <SecretInput {...p} value={form.value} onChange={(e) => update('value', e.target.value)} />}
      </Field>
      {showDescription && (
        <Field label="Description" optional>
          {(p) => (
            <TextArea
              {...p}
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What is this secret used for?"
            />
          )}
        </Field>
      )}
      <div className="info-box">
        <Shield className="info-box-icon" aria-hidden />
        <p>
          You will be the owner of this secret. You can grant access to teammates from <strong>Access control</strong> after saving.
        </p>
      </div>
    </Modal>
  );
}

// Rotate: new value -> PUT /rotate. `onDenied` receives the 403 for the caller to show mockup 06.
export function RotateSecretModal({ secret, onClose, onRotated, onDenied }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextVersion = secret.version + 1;

  async function submit(e) {
    e.preventDefault();
    setSubmitted(true);
    const found = validateValue(value);
    setError(found);
    if (found) return;
    setBusy(true);
    try {
      const result = await api.rotateSecret(secret.id, value);
      toast.success(`${secret.name} rotated to v${result.version}`);
      onRotated?.(result);
      onClose();
    } catch (err) {
      setBusy(false);
      if (err.status === 403 && onDenied) {
        onClose();
        onDenied(err);
      } else if (err.status === 409) {
        setError(err.message);
      } else if (err.status !== 401) {
        toast.error(`Couldn't rotate ${secret.name}: ${err.message}`);
      }
    }
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title="Rotate secret"
      subtitle={
        <>
          <span className="mono">{secret.name}</span> · v{secret.version} → v{nextVersion}
        </>
      }
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" icon={RotateCw} loading={busy}>Rotate to v{nextVersion}</Button>
        </>
      }
    >
      <Field label="New value" hint="The current value is archived and stays encrypted." error={error}>
        {(p) => (
          <SecretInput
            {...p}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (submitted) setError(validateValue(e.target.value));
            }}
          />
        )}
      </Field>
      <div className="info-box">
        <Shield className="info-box-icon" aria-hidden />
        <p>Services using the current value will need the new one. This rotation is recorded in the audit log.</p>
      </div>
    </Modal>
  );
}

export function DeleteSecretModal({ secret, onClose, onDeleted, onDenied }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await api.deleteSecret(secret.id);
      toast.success(`${secret.name} deleted`);
      onClose();
      onDeleted?.();
    } catch (err) {
      setBusy(false);
      if (err.status === 403 && onDenied) {
        onClose();
        onDenied(err);
      } else if (err.status !== 401) {
        toast.error(`Couldn't delete ${secret.name}: ${err.message}`);
      }
    }
  }

  return (
    <Modal
      title="Delete secret"
      subtitle="This can't be undone."
      onClose={onClose}
      busy={busy}
      width={460}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger-solid" icon={Trash2} loading={busy} onClick={confirm}>Delete secret</Button>
        </>
      }
    >
      <p className="modal-text">
        <span className="mono modal-strong">{secret.name}</span> and all of its versions will be permanently deleted. Anyone with access
        loses it immediately.
      </p>
    </Modal>
  );
}
