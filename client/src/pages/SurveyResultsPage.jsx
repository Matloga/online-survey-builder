import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  surveyApi,
  analyticsApi,
  responseApi,
  downloadExport,
  shareUrlFor,
} from '../services/api.js';
import {
  ResponseTrendChart,
  BreakdownBarChart,
  RatingChart,
  TextBreakdown,
} from '../charts/index.jsx';
import {
  Loader,
  ErrorAlert,
  EmptyState,
  StatCard,
  StatusBadge,
  Modal,
} from '../components/ui.jsx';
import {
  formatNumber,
  formatDateTime,
  QUESTION_TYPE_LABELS,
  TYPES_WITH_OPTIONS,
} from '../services/constants.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'questions', label: 'Questions' },
  { key: 'responses', label: 'Responses' },
];

export default function SurveyResultsPage() {
  const { id } = useParams();
  const surveyId = Number(id);

  const [survey, setSurvey] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([surveyApi.get(surveyId), analyticsApi.forSurvey(surveyId)])
      .then(([surveyRes, analyticsRes]) => {
        if (!active) return;
        setSurvey(surveyRes.survey);
        setAnalytics(analyticsRes);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [surveyId]);

  if (loading) return <Loader label="Loading results…" />;
  if (error) return <ErrorAlert error={error} onDismiss={() => setError(null)} />;
  if (!survey) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>{survey.title}</h1>
            <StatusBadge status={survey.status} />
            {survey.expired && <span className="badge badge--closed">Expired</span>}
          </div>
          <p className="muted">
            {survey.category || 'Uncategorised'} · Created {formatDateTime(survey.createdAt)}
            {survey.expiresAt && ` · Closes ${formatDateTime(survey.expiresAt)}`}
          </p>
        </div>

        <div className="page-head__actions">
          <button type="button" className="btn" onClick={() => setShowShare(true)}>
            Share
          </button>
          <Link to={`/surveys/${surveyId}/edit`} className="btn btn--secondary">
            Edit
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Total responses"
          value={formatNumber(analytics.summary.totalResponses)}
          hint={`${analytics.summary.responsesLast7Days} in the last 7 days`}
        />
        <StatCard
          label="Completion rate"
          value={`${analytics.summary.completionRate}%`}
          hint="Question slots answered"
        />
        <StatCard
          label="Average rating"
          value={analytics.rating.average ?? '—'}
          hint={analytics.rating.count ? `Across ${analytics.rating.count} ratings` : 'No ratings yet'}
        />
        <StatCard
          label="Questions"
          value={formatNumber(analytics.summary.totalQuestions)}
          hint="In this survey"
        />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="stack">
          <section className="card">
            <h2>Response trend</h2>
            <p className="muted small">Submissions per day over the last 30 days.</p>
            <ResponseTrendChart trend={analytics.trend} />
          </section>

          <section className="card">
            <h2>Export data</h2>
            <p className="muted small">
              Download every response. CSV and Excel include one row per submission; the PDF
              includes a summary plus individual responses.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!analytics.summary.totalResponses}
                onClick={() => downloadExport(surveyId, 'csv')}
              >
                Download CSV
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!analytics.summary.totalResponses}
                onClick={() => downloadExport(surveyId, 'excel')}
              >
                Download Excel
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!analytics.summary.totalResponses}
                onClick={() => downloadExport(surveyId, 'pdf')}
              >
                Download PDF
              </button>
            </div>
            {!analytics.summary.totalResponses && (
              <p className="muted small" style={{ marginTop: '0.6rem' }}>
                Exports become available once responses arrive.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'questions' && (
        <div className="stack">
          {analytics.questions.length === 0 ? (
            <EmptyState title="No questions yet" description="Add questions in the builder." />
          ) : (
            analytics.questions.map((q) => (
              <section className="card" key={q.questionId}>
                <div className="spread">
                  <h2 style={{ margin: 0 }}>{q.text}</h2>
                  <span className="badge badge--neutral">
                    {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                  </span>
                </div>
                <p className="muted small">
                  {formatNumber(q.answered)} answer{q.answered === 1 ? '' : 's'}
                  {q.required && ' · required'}
                </p>

                {q.type === 'rating' ? (
                  <RatingChart breakdown={q.breakdown} average={q.average} />
                ) : TYPES_WITH_OPTIONS.has(q.type) ? (
                  <BreakdownBarChart breakdown={q.breakdown} />
                ) : (
                  <TextBreakdown breakdown={q.breakdown} questionType={q.type} />
                )}
              </section>
            ))
          )}
        </div>
      )}

      {tab === 'responses' && (
        <ResponsesTab surveyId={surveyId} anonymous={survey.anonymousResponses} />
      )}

      {showShare && <ShareModal survey={survey} onClose={() => setShowShare(false)} />}
    </>
  );
}

function ShareModal({ survey, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = shareUrlFor(survey.shareToken);
  const [rotating, setRotating] = useState(false);
  const [token, setToken] = useState(survey.shareToken);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm('Generate a new link? The old link will stop working.')) return;
    setRotating(true);
    try {
      const { survey: updated } = await surveyApi.rotateShareToken(survey.id);
      setToken(updated.shareToken);
    } finally {
      setRotating(false);
    }
  };

  const currentUrl = url.replace(survey.shareToken, token);

  return (
    <Modal title="Share this survey" onClose={onClose}>
      <p className="muted small">
        Anyone with this link can respond. Responses are{ ' '}
        {survey.anonymousResponses ? 'anonymous' : 'tracked where possible'}.
      </p>

      <div className="share-box">
        <input type="text" value={currentUrl} readOnly onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn--secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() =>
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`Please complete my survey: ${currentUrl}`)}`,
              '_blank',
            )
          }
        >
          Share on WhatsApp
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() =>
            window.open(
              `mailto:?subject=${encodeURIComponent(survey.title)}&body=${encodeURIComponent(currentUrl)}`,
              '_blank',
            )
          }
        >
          Share by email
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={rotate}
          disabled={rotating}
        >
          {rotating ? 'Regenerating…' : 'Reset link'}
        </button>
      </div>

      {survey.status !== 'published' && (
        <p className="alert alert--info" style={{ marginTop: '1rem', marginBottom: 0 }}>
          This survey is a {survey.status}. Publish it before sharing the link.
        </p>
      )}
    </Modal>
  );
}

function ResponsesTab({ surveyId, anonymous }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = (page = 1) => {
    setLoading(true);
    responseApi
      .list(surveyId, { pageSize: 25, page })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    responseApi
      .list(surveyId, { pageSize: 25, page: 1 })
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [surveyId]);

  const openDetail = async (id) => {
    try {
      const { response } = await responseApi.get(surveyId, id);
      setSelected(response);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this response? This cannot be undone.')) return;
    try {
      await responseApi.remove(surveyId, id);
      setSelected(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Loader label="Loading responses…" />;
  if (error) return <ErrorAlert error={error} onDismiss={() => setError(null)} />;

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No responses yet"
        description="Share the survey link to start collecting responses."
      />
    );
  }

  return (
    <section className="card">
      <h2>Individual responses</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Submitted</th>
              <th>{anonymous ? 'Respondent' : 'Respondent'}</th>
              <th>Answers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td className="small">{formatDateTime(r.submittedAt)}</td>
                <td className="small">{r.respondentEmail ?? 'Anonymous'}</td>
                <td>{r.answers.length}</td>
                <td>
                  <div className="row" style={{ gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => openDetail(r.id)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => remove(r.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationRow page={data.page} total={data.total} onChange={(page) => load(page)} />

      {selected && (
        <Modal title={`Response #${selected.id}`} onClose={() => setSelected(null)}>
          <p className="muted small">
            Submitted {formatDateTime(selected.submittedAt)} by{' '}
            {selected.respondentEmail ?? 'Anonymous'}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Answer</th>
                </tr>
              </thead>
              <tbody>
                {selected.answers.map((a) => (
                  <tr key={a.questionId}>
                    <td>{a.questionText}</td>
                    <td>{Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}

function PaginationRow({ page, total, onChange }) {
  const totalPages = Math.ceil(total / 25);
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="small muted">
        Page {page} of {totalPages} · {total} responses
      </span>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}