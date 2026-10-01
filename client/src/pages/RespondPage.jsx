import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../services/api.js';
import { Loader, ErrorAlert } from '../components/ui.jsx';
import { RATING_LABELS } from '../services/constants.js';

export default function RespondPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let active = true;
    publicApi
      .survey(token)
      .then((res) => {
        if (!active) return;
        setData(res);
        // Seed defaults so optional questions submit cleanly
        setAnswers(
          Object.fromEntries(
            res.questions.map((q) => [q.id, defaultValue(q)]),
          ),
        );
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const set = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const toggleCheckbox = (question, option) => {
    const current = Array.isArray(answers[question.id]) ? answers[question.id] : [];
    set(
      question.id,
      current.includes(option) ? current.filter((o) => o !== option) : [...current, option],
    );
  };

  /** Client-side mirror of the server rules so users see errors immediately. */
  const validate = () => {
    const found = {};
    for (const q of data.questions) {
      const value = answers[q.id];
      const empty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (q.required && empty) found[q.id] = 'This question is required';
    }
    return found;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    setError(null);
    try {
      const payload = data.questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id],
      }));
      const result = await publicApi.submit(token, payload);
      setDone(result);
    } catch (err) {
      setError(err.message);
      setErrors(err.fieldErrors || {});
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="public-shell">
        <Loader label="Loading survey…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="public-shell">
        <div className="public-card">
          <ErrorAlert error={error} />
          <p className="muted small">
            Check that the link is complete, or ask the survey owner for a new one.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="public-shell">
        <div className="public-card">
          <h1>Thank you</h1>
          <p>{done.message}</p>
          <p className="muted small">
            Your reference number is {done.responseId}. Keep it if you need to follow up with the
            survey owner.
          </p>
        </div>
      </div>
    );
  }

  const { survey, questions, alreadySubmitted } = data;

  return (
    <div className="public-shell">
      <div className="public-card">
        <h1>{survey.title}</h1>
        {survey.description && <p className="muted">{survey.description}</p>}

        {alreadySubmitted && !survey.allowMultipleResponses && (
          <div className="alert alert--info">
            You have already submitted a response to this survey.
          </div>
        )}

        {error && <ErrorAlert error={error} onDismiss={() => setError(null)} />}

        <form onSubmit={onSubmit} noValidate>
          {questions.map((q, index) => (
            <div className="public-question" key={q.id}>
              <label className="public-question__label" htmlFor={`q-${q.id}`}>
                <span>
                  {index + 1}. {q.text}
                </span>
                {q.required && (
                  <span className="required-mark" aria-hidden="true">
                    *
                  </span>
                )}
              </label>

              <QuestionInput
                question={q}
                value={answers[q.id]}
                error={errors[q.id]}
                onChange={(v) => set(q.id, v)}
                onToggle={(option) => toggleCheckbox(q, option)}
              />

              {errors[q.id] && <p className="field-error">{errors[q.id]}</p>}
            </div>
          ))}

          <button
            type="submit"
            className="btn btn--block"
            style={{ marginTop: '1.5rem' }}
            disabled={busy}
          >
            {busy ? 'Submitting…' : 'Submit response'}
          </button>

          {survey.anonymousResponses && (
            <p className="muted small" style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              This survey is anonymous — no identifying information is stored.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function QuestionInput({ question, value, error, onChange, onToggle }) {
  const common = {
    id: `q-${question.id}`,
    'aria-invalid': Boolean(error),
  };

  switch (question.type) {
    case 'short-text':
      return (
        <input
          {...common}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.settings?.placeholder ?? 'Type your answer'}
        />
      );

    case 'long-text':
      return (
        <textarea
          {...common}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer"
        />
      );

    case 'dropdown':
      return (
        <select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose an option…</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'multiple-choice':
      return (
        <div role="radiogroup" aria-labelledby={`q-${question.id}`}>
          {question.options.map((option) => (
            <label
              key={option}
              className={`choice-option ${value === option ? 'choice-option--selected' : ''}`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );

    case 'checkboxes':
      return (
        <div>
          {question.options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option);
            return (
              <label
                key={option}
                className={`choice-option ${selected ? 'choice-option--selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );

    case 'rating': {
      const min = question.settings?.min ?? 1;
      const max = question.settings?.max ?? 5;
      return (
        <div className="rating-scale" role="radiogroup">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`rating-btn ${Number(value) === n ? 'rating-btn--active' : ''}`}
              onClick={() => onChange(n)}
              aria-pressed={Number(value) === n}
              title={RATING_LABELS[n]}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }

    case 'yes-no':
      return (
        <div className="row">
          {['yes', 'no'].map((option) => (
            <label
              key={option}
              className={`choice-option ${value === option ? 'choice-option--selected' : ''}`}
              style={{ marginBottom: 0 }}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span style={{ textTransform: 'capitalize' }}>{option}</span>
            </label>
          ))}
        </div>
      );

    default:
      return null;
  }
}

function defaultValue(question) {
  switch (question.type) {
    case 'checkboxes':
      return [];
    case 'rating':
      return null;
    default:
      return '';
  }
}