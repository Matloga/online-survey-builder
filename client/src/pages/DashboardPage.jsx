import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { surveyApi } from '../services/api.js';
import {
  ResponseTrendChart,
  CategoryChart,
  StatusDonut,
} from '../charts/index.jsx';
import { Loader, StatCard, ErrorAlert, EmptyState } from '../components/ui.jsx';
import { formatNumber } from '../services/constants.js';

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([surveyApi.overview(), surveyApi.list({ pageSize: 5, sort: 'updatedAt' })])
      .then(([stats, surveys]) => {
        if (!active) return;
        setOverview(stats);
        setRecent(surveys.items);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Loader label="Loading your dashboard…" />;
  if (error) return <ErrorAlert error={error} onDismiss={() => setError(null)} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">An overview of your surveys and collected responses.</p>
        </div>
        <div className="page-head__actions">
          <Link to="/surveys/new" className="btn">
            + New survey
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Total surveys"
          value={formatNumber(overview.totalSurveys)}
          hint={`${overview.publishedSurveys} live · ${overview.draftSurveys} draft · ${overview.closedSurveys} closed`}
        />
        <StatCard
          label="Total responses"
          value={formatNumber(overview.totalResponses)}
          hint={`${formatNumber(overview.responsesLast7Days)} in the last 7 days`}
        />
        <StatCard
          label="Live surveys"
          value={formatNumber(overview.publishedSurveys)}
          hint="Accepting responses now"
        />
        <StatCard
          label="Response rate"
          value={
            overview.totalSurveys
              ? `${(overview.totalResponses / overview.totalSurveys).toFixed(1)}`
              : '0'
          }
          hint="Average responses per survey"
        />
      </div>

      <div className="chart-grid">
        <section className="card">
          <h2>Response trend</h2>
          <p className="muted small">Daily submissions across all your surveys, last 30 days.</p>
          <ResponseTrendChart trend={overview.trend} />
        </section>

        <section className="card">
          <h2>Survey status</h2>
          <StatusDonut
            draft={overview.draftSurveys}
            published={overview.publishedSurveys}
            closed={overview.closedSurveys}
          />
        </section>
      </div>

      <section className="card" style={{ marginTop: '1rem' }}>
        <h2>Surveys by category</h2>
        <CategoryChart byCategory={overview.byCategory} />
      </section>

      <section className="card" style={{ marginTop: '1rem' }}>
        <div className="spread">
          <h2>Recently updated</h2>
          <Link to="/surveys" className="small">
            View all surveys
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No surveys yet"
            description="Create your first survey to start collecting responses."
            action={
              <Link to="/surveys/new" className="btn" style={{ marginTop: '0.5rem' }}>
                Create a survey
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Questions</th>
                  <th>Responses</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((survey) => (
                  <tr key={survey.id}>
                    <td>
                      <Link to={`/surveys/${survey.id}`}>{survey.title}</Link>
                    </td>
                    <td>
                      <span className={`badge badge--${survey.status}`}>{survey.status}</span>
                    </td>
                    <td>{survey.questionCount}</td>
                    <td>{survey.responseCount}</td>
                    <td className="muted small">
                      {new Date(survey.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}