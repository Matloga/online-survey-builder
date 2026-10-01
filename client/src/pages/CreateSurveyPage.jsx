import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { surveyApi } from '../services/api.js';
import { CATEGORY_OPTIONS } from '../services/constants.js';
import { ErrorAlert, FieldError } from '../components/ui.jsx';

const EMPTY = {
  title: '',
  description: '',
  category: '',
  anonymousResponses: false,
  allowMultipleResponses: false,
  expiresAt: '',
};

export default function CreateSurveyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const { survey } = await surveyApi.create({
        title: form.title,
        description: form.description,
        category: form.category,
        anonymousResponses: form.anonymousResponses,
        allowMultipleResponses: form.allowMultipleResponses,
        expiresAt: form.expiresAt || null,
      });
      navigate(`/surveys/${survey.id}/edit`);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Create a survey</h1>
          <p className="muted">Give it a title, then add your questions.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <ErrorAlert error={error} onDismiss={() => setError(null)} />

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="title">Survey title *</label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={update('title')}
              placeholder="Customer Experience Survey 2026"
              aria-invalid={Boolean(fieldErrors.title)}
            />
            <FieldError errors={fieldErrors} name="title" />
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={update('description')}
              placeholder="Tell respondents what this survey is about and how long it takes."
            />
            <FieldError errors={fieldErrors} name="description" />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" value={form.category} onChange={update('category')}>
                <option value="">Uncategorised</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="expiresAt">Expiration date (optional)</label>
              <input
                id="expiresAt"
                type="datetime-local"
                value={form.expiresAt}
                onChange={update('expiresAt')}
              />
              <FieldError errors={fieldErrors} name="expiresAt" />
              <p className="muted small" style={{ marginTop: '0.25rem' }}>
                Responses are blocked after this date.
              </p>
            </div>
          </div>

          <fieldset>
            <legend>Response options</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={form.anonymousResponses}
                onChange={update('anonymousResponses')}
              />
              <span>
                <strong>Anonymous responses</strong>
                <br />
                <span className="muted small">
                  Respondent identities are never stored, even for logged-in visitors.
                </span>
              </span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.allowMultipleResponses}
                onChange={update('allowMultipleResponses')}
              />
              <span>
                <strong>Allow multiple submissions</strong>
                <br />
                <span className="muted small">
                  Off by default: each person or device can submit only once.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={busy || form.title.trim().length < 3}>
              {busy ? 'Creating…' : 'Create and add questions'}
            </button>
            <Link to="/surveys" className="btn btn--secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}