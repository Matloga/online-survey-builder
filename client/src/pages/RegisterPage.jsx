import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorAlert, FieldError } from '../components/ui.jsx';

const EMPTY = { name: '', email: '', password: '', confirm: '' };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' });
      return;
    }

    setBusy(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="muted">Start building and sharing surveys.</p>

        <ErrorAlert error={error} onDismiss={() => setError(null)} />

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={update('name')}
              placeholder="Thandi Mokoena"
              autoComplete="name"
              required
              aria-invalid={Boolean(fieldErrors.name)}
            />
            <FieldError errors={fieldErrors} name="name" />
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="you@example.com"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
            />
            <FieldError errors={fieldErrors} name="email" />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
            />
            <FieldError errors={fieldErrors} name="password" />
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              value={form.confirm}
              onChange={update('confirm')}
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
              aria-invalid={Boolean(fieldErrors.confirm)}
            />
            <FieldError errors={fieldErrors} name="confirm" />
          </div>

          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}