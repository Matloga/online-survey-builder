import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../services/api.js';
import { Loader, ErrorAlert, FieldError } from '../components/ui.jsx';
import { formatDate, initials } from '../services/constants.js';

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [profile, setProfile] = useState({ name: user.name, email: user.email });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const [profileState, setProfileState] = useState({ error: null, fields: {}, message: null, busy: false });
  const [passwordState, setPasswordState] = useState({ error: null, fields: {}, message: null, busy: false });

  if (!user) return <Loader />;

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileState({ error: null, fields: {}, message: null, busy: true });
    try {
      const { user: updated } = await authApi.updateProfile(profile);
      setUser(updated);
      setProfileState({ error: null, fields: {}, message: 'Profile updated', busy: false });
    } catch (err) {
      setProfileState({
        error: err.message,
        fields: err.fieldErrors || {},
        message: null,
        busy: false,
      });
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();

    if (passwords.newPassword !== passwords.confirm) {
      setPasswordState({
        error: null,
        fields: { confirm: 'Passwords do not match' },
        message: null,
        busy: false,
      });
      return;
    }

    setPasswordState({ error: null, fields: {}, message: null, busy: true });
    try {
      await authApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setPasswordState({
        error: null,
        fields: {},
        message: 'Password updated',
        busy: false,
      });
    } catch (err) {
      setPasswordState({
        error: err.message,
        fields: err.fieldErrors || {},
        message: null,
        busy: false,
      });
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <p className="muted">Member since {formatDate(user.createdAt)}.</p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={logout}>
          Log out
        </button>
      </div>

      <div className="card" style={{ maxWidth: 520, marginBottom: '1rem' }}>
        <div className="row" style={{ gap: '0.9rem', marginBottom: '1.25rem' }}>
          <span className="brand__mark" style={{ width: 48, height: 48, fontSize: '1.05rem' }}>
            {initials(user.name)}
          </span>
          <div>
            <strong>{user.name}</strong>
            <div className="muted small">{user.email}</div>
            <span className="badge badge--neutral" style={{ marginTop: '0.25rem' }}>
              {user.role}
            </span>
          </div>
        </div>

        <h2>Account details</h2>
        {profileState.message && <div className="alert alert--success">{profileState.message}</div>}
        <ErrorAlert error={profileState.error} />

        <form onSubmit={saveProfile} noValidate>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              aria-invalid={Boolean(profileState.fields.name)}
            />
            <FieldError errors={profileState.fields} name="name" />
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              aria-invalid={Boolean(profileState.fields.email)}
            />
            <FieldError errors={profileState.fields} name="email" />
          </div>

          <button type="submit" className="btn" disabled={profileState.busy}>
            {profileState.busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h2>Change password</h2>
        {passwordState.message && <div className="alert alert--success">{passwordState.message}</div>}
        <ErrorAlert error={passwordState.error} />

        <form onSubmit={savePassword} noValidate>
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, currentPassword: e.target.value }))
              }
              autoComplete="current-password"
              aria-invalid={Boolean(passwordState.fields.currentPassword)}
            />
            <FieldError errors={passwordState.fields} name="currentPassword" />
          </div>

          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
              autoComplete="new-password"
              aria-invalid={Boolean(passwordState.fields.newPassword)}
            />
            <FieldError errors={passwordState.fields} name="newPassword" />
            <p className="muted small">At least 8 characters.</p>
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm new password</label>
            <input
              id="confirm"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
              aria-invalid={Boolean(passwordState.fields.confirm)}
            />
            <FieldError errors={passwordState.fields} name="confirm" />
          </div>

          <button type="submit" className="btn" disabled={passwordState.busy}>
            {passwordState.busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </>
  );
}