import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { surveyApi } from '../services/api.js';
import {
  SURVEY_STATUSES,
  formatDate,
  relativeTime,
} from '../services/constants.js';
import {
  Loader,
  EmptyState,
  ErrorAlert,
  Pagination,
  StatusBadge,
} from '../components/ui.jsx';

const DEFAULT_FILTERS = { search: '', category: '', status: '', sort: 'createdAt', order: 'desc' };

export default function SurveyListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [searchText, setSearchText] = useState(params.get('search') ?? '');

  const page = Number(params.get('page')) || 1;
  const filters = useMemo(
    () => ({
      search: params.get('search') ?? '',
      category: params.get('category') ?? '',
      status: params.get('status') ?? '',
      sort: params.get('sort') ?? DEFAULT_FILTERS.sort,
      order: params.get('order') ?? DEFAULT_FILTERS.order,
      page,
      pageSize: 12,
    }),
    [params, page],
  );

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const load = useCallback(async () => {
    try {
      const result = await surveyApi.list(filters);
      setData(result);
    } catch (err) {
      setError(err.message);
    }
  }, [filters]);

  useEffect(() => {
    let active = true;
    surveyApi
      .list(filters)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    let active = true;
    surveyApi
      .categories()
      .then((res) => active && setCategories(res.categories))
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, []);

  // Debounce the free-text search so each keystroke does not hit the API
  useEffect(() => {
    if (searchText === filters.search) return undefined;
    const timer = setTimeout(() => setFilter('search', searchText), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const onDelete = async (survey) => {
    if (!window.confirm(`Delete "${survey.title}"? All of its responses will be removed.`)) return;
    setBusyId(survey.id);
    try {
      await surveyApi.remove(survey.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const onToggleStatus = async (survey) => {
    const next = survey.status === 'published' ? 'closed' : 'published';
    setBusyId(survey.id);
    try {
      await surveyApi.setStatus(survey.id, next);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const onDuplicate = async (survey) => {
    setBusyId(survey.id);
    try {
      const { survey: copy } = await surveyApi.duplicate(survey.id);
      navigate(`/surveys/${copy.id}/edit`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My surveys</h1>
          <p className="muted">Search, filter and manage everything you have created.</p>
        </div>
        <div className="page-head__actions">
          <Link to="/surveys/new" className="btn">
            + New survey
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <div className="field field--grow">
          <label htmlFor="search">Search by title or description</label>
          <input
            id="search"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search surveys…"
          />
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {SURVEY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select
            id="sort"
            value={`${filters.sort}:${filters.order}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':');
              const next = new URLSearchParams(params);
              next.set('sort', sort);
              next.set('order', order);
              setParams(next);
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="title:asc">Title A–Z</option>
            <option value="title:desc">Title Z–A</option>
            <option value="responses:desc">Most responses</option>
            <option value="updatedAt:desc">Recently updated</option>
          </select>
        </div>
      </div>

      <ErrorAlert error={error} onDismiss={() => setError(null)} />

      {!data ? (
        <Loader label="Loading surveys…" />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No surveys match your filters"
          description="Try clearing the search box or creating a new survey."
          action={
            <Link to="/surveys/new" className="btn" style={{ marginTop: '0.5rem' }}>
              Create a survey
            </Link>
          }
        />
      ) : (
        <div className="survey-grid">
          {data.items.map((survey) => (
            <article className="survey-card" key={survey.id}>
              <div className="spread">
                <h3 className="survey-card__title">
                  <Link to={`/surveys/${survey.id}`}>{survey.title}</Link>
                </h3>
                <StatusBadge status={survey.status} />
              </div>

              {survey.description && (
                <p className="muted small" style={{ margin: 0 }}>
                  {survey.description.length > 110
                    ? `${survey.description.slice(0, 110)}…`
                    : survey.description}
                </p>
              )}

              <div className="survey-card__meta">
                <span>{survey.questionCount} questions</span>
                <span>·</span>
                <span>
                  {survey.responseCount} response{survey.responseCount === 1 ? '' : 's'}
                </span>
                {survey.category && (
                  <>
                    <span>·</span>
                    <span>{survey.category}</span>
                  </>
                )}
                {survey.expired && (
                  <>
                    <span>·</span>
                    <span style={{ color: 'var(--danger)' }}>Expired</span>
                  </>
                )}
              </div>

              <div className="muted small">
                Created {relativeTime(survey.createdAt)}
                {survey.expiresAt && ` · Closes ${formatDate(survey.expiresAt)}`}
              </div>

              <div className="survey-card__actions">
                <Link
                  to={`/surveys/${survey.id}/edit`}
                  className="btn btn--secondary btn--sm"
                >
                  Edit
                </Link>
                <Link to={`/surveys/${survey.id}`} className="btn btn--secondary btn--sm">
                  Results
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => onToggleStatus(survey)}
                  disabled={busyId === survey.id}
                >
                  {survey.status === 'published' ? 'Close' : 'Publish'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => onDuplicate(survey)}
                  disabled={busyId === survey.id}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => onDelete(survey)}
                  disabled={busyId === survey.id}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onChange={(p) => setFilter('page', String(p))}
        />
      )}
    </>
  );
}