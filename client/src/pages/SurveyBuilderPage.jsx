import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { questionApi, surveyApi } from '../services/api.js';
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  TYPES_WITH_OPTIONS,
} from '../services/constants.js';
import { Loader, ErrorAlert, FieldError } from '../components/ui.jsx';

const BLANK = {
  type: 'short-text',
  text: '',
  required: false,
  options: ['', ''],
  settings: { min: 1, max: 5 },
};

let tempId = 0;

export default function SurveyBuilderPage() {
  const { id } = useParams();
  const surveyId = Number(id);
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    questionApi
      .list(surveyId)
      .then(({ questions: list }) => {
        if (!active) return;
        setQuestions(list.map((q) => ({ ...q, clientKey: `saved-${q.id}` })));
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [surveyId]);

  const addQuestion = () => {
    tempId += 1;
    setQuestions((prev) => [...prev, { ...BLANK, clientKey: `new-${tempId}`, options: ['', ''] }]);
    setFieldErrors({});
  };

  const update = (clientKey, patch) =>
    setQuestions((prev) =>
      prev.map((q) => (q.clientKey === clientKey ? { ...q, ...patch } : q)),
    );

  const onTypeChange = (clientKey, type) => {
    const patch = { type };
    if (TYPES_WITH_OPTIONS.has(type)) patch.options = ['', ''];
    if (type === 'rating') patch.settings = { min: 1, max: 5 };
    update(clientKey, patch);
  };

  const setOption = (clientKey, index, value) =>
    update(clientKey, {
      options: questions
        .find((q) => q.clientKey === clientKey)
        .options.map((opt, i) => (i === index ? value : opt)),
    });

  const addOption = (clientKey) =>
    update(clientKey, {
      options: [...questions.find((q) => q.clientKey === clientKey).options, ''],
    });

  const removeOption = (clientKey, index) => {
    const current = questions.find((q) => q.clientKey === clientKey);
    if (current.options.length <= 2) return;
    update(clientKey, { options: current.options.filter((_, i) => i !== index) });
  };

  const move = (index, direction) =>
    setQuestions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeQuestion = (clientKey) =>
    setQuestions((prev) => prev.filter((q) => q.clientKey !== clientKey));

  const persist = async (question) => {
    const payload = {
      type: question.type,
      text: question.text.trim(),
      required: question.required,
      settings: question.type === 'rating' ? question.settings : {},
    };
    if (TYPES_WITH_OPTIONS.has(question.type)) {
      payload.options = question.options.map((o) => o.trim()).filter(Boolean);
    }

    if (question.clientKey.startsWith('new-')) {
      const { question: created } = await questionApi.create(surveyId, payload);
      return { ...created, clientKey: `saved-${created.id}` };
    }

    const { question: updated } = await questionApi.update(surveyId, question.id, payload);
    return { ...updated, clientKey: `saved-${updated.id}` };
  };

  const save = async (question) => {
    setSavingId(question.clientKey);
    setError(null);
    setFieldErrors({});
    try {
      const saved = await persist(question);
      setQuestions((prev) =>
        prev.map((q) => (q.clientKey === question.clientKey ? saved : q)),
      );
      return true;
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      return false;
    } finally {
      setSavingId(null);
    }
  };

  /** Save every question; the first failure surfaces and stops the publish. */
  const saveAll = async () => {
    setError(null);
    setFieldErrors({});
    for (const question of questions) {
      // Sequential so the first invalid question's errors are the ones shown
      const saved = await persist(question);
      setQuestions((prev) =>
        prev.map((q) => (q.clientKey === question.clientKey ? saved : q)),
      );
    }
  };

  const removeSaved = async (question) => {
    if (!question.text.trim() && !window.confirm('Remove this question?')) return;
    if (question.clientKey.startsWith('saved-')) {
      try {
        await questionApi.remove(surveyId, question.id);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    removeQuestion(question.clientKey);
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await saveAll();
      await surveyApi.setStatus(surveyId, 'published');
      navigate(`/surveys/${surveyId}`);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setBusy(false);
    }
  };

  const canPublish = useMemo(() => questions.length > 0, [questions]);

  if (loading) return <Loader label="Loading questions…" />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Survey builder</h1>
          <p className="muted">
            Add questions, then publish to start collecting responses.
          </p>
        </div>
        <div className="page-head__actions">
          <Link to={`/surveys/${surveyId}`} className="btn btn--secondary">
            View results
          </Link>
          <button
            type="button"
            className="btn"
            onClick={publish}
            disabled={!canPublish || busy}
            title={canPublish ? '' : 'Add at least one question first'}
          >
            {busy ? 'Publishing…' : 'Publish survey'}
          </button>
        </div>
      </div>

      <ErrorAlert error={error} onDismiss={() => setError(null)} />

      {questions.length === 0 ? (
        <div className="card empty-state">
          <h3>No questions yet</h3>
          <p>Start by adding your first question below.</p>
        </div>
      ) : (
        questions.map((question, index) => (
          <QuestionEditor
            key={question.clientKey}
            question={question}
            index={index}
            total={questions.length}
            saving={savingId === question.clientKey}
            fieldErrors={fieldErrors}
            onTypeChange={(t) => onTypeChange(question.clientKey, t)}
            onChange={(patch) => update(question.clientKey, patch)}
            onOptionChange={(i, v) => setOption(question.clientKey, i, v)}
            onOptionAdd={() => addOption(question.clientKey)}
            onOptionRemove={(i) => removeOption(question.clientKey, i)}
            onMove={(dir) => move(index, dir)}
            onRemove={() => removeSaved(question)}
            onSave={() => save(question)}
          />
        ))
      )}

      <button type="button" className="btn btn--secondary" onClick={addQuestion}>
        + Add question
      </button>
    </>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  saving,
  fieldErrors,
  onTypeChange,
  onChange,
  onOptionChange,
  onOptionAdd,
  onOptionRemove,
  onMove,
  onRemove,
  onSave,
}) {
  const needsOptions = TYPES_WITH_OPTIONS.has(question.type);

  return (
    <div className="question-editor">
      <div className="question-editor__head">
        <span className="question-editor__index">{index + 1}</span>
        <div style={{ flex: 1 }}>
          <div className="spread">
            <span className="muted small">{QUESTION_TYPE_LABELS[question.type]}</span>
            <div className="row" style={{ gap: '0.35rem' }}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onMove(-1)}
                disabled={index === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onMove(1)}
                disabled={index === total - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={onRemove}
                aria-label="Delete question"
                style={{ color: 'var(--danger)' }}
              >
                ×
              </button>
            </div>
          </div>

          <div className="field" style={{ marginTop: '0.4rem' }}>
            <label htmlFor={`text-${question.clientKey}`}>Question text</label>
            <input
              id={`text-${question.clientKey}`}
              type="text"
              value={question.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="What would you like to ask?"
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor={`type-${question.clientKey}`}>Answer type</label>
              <select
                id={`type-${question.clientKey}`}
                value={question.type}
                onChange={(e) => onTypeChange(e.target.value)}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {question.type === 'rating' && (
              <div className="field">
                <label>Scale</label>
                <div className="row" style={{ gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    style={{ width: 70 }}
                    value={question.settings?.min ?? 1}
                    onChange={(e) =>
                      onChange({
                        settings: {
                          ...question.settings,
                          min: Number(e.target.value),
                        },
                      })
                    }
                    aria-label="Minimum rating"
                  />
                  <span className="muted">to</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    style={{ width: 70 }}
                    value={question.settings?.max ?? 5}
                    onChange={(e) =>
                      onChange({
                        settings: {
                          ...question.settings,
                          max: Number(e.target.value),
                        },
                      })
                    }
                    aria-label="Maximum rating"
                  />
                </div>
              </div>
            )}
          </div>

          {needsOptions && (
            <fieldset>
              <legend>Options</legend>
              {question.options.map((option, i) => (
                <div className="option-row" key={i}>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => onOptionChange(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onOptionRemove(i)}
                    disabled={question.options.length <= 2}
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={onOptionAdd}
              >
                + Add option
              </button>
              <FieldError
                errors={fieldErrors}
                name={`question_${question.id ?? question.clientKey}`}
              />
            </fieldset>
          )}

          <div className="spread">
            <label className="check" style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              <span>Required</span>
            </label>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={onSave}
              disabled={saving || !question.text.trim()}
            >
              {saving ? 'Saving…' : question.clientKey.startsWith('new-') ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}