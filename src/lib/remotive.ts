import { queryCoralEngine, generateJobSearchSQL, REMOTIVE_JOBS_SELECT } from '@/lib/coral';

/** Job row from Coral `remotive.jobs` (see community remotive manifest). */
export type RemotiveJob = {
  id: number;
  title: string;
  company_name: string;
  url: string;
  category: string | null;
  tags: string | null;
  job_type: string | null;
  publication_date: string | null;
  candidate_required_location: string | null;
  salary: string | null;
  search: string | null;
};

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function toCoralCategory(category?: string | null): string {
  if (!category) return 'Software Development';
  const map: Record<string, string> = {
    'software-development': 'Software Development',
    'software-dev': 'Software Development',
  };
  return map[category] ?? category;
}

function normalizeJob(row: Record<string, unknown>): RemotiveJob {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    company_name: String(row.company_name ?? ''),
    url: String(row.url ?? ''),
    category: row.category != null ? String(row.category) : null,
    tags: row.tags != null ? String(row.tags) : null,
    job_type: row.job_type != null ? String(row.job_type) : null,
    publication_date:
      row.publication_date != null ? String(row.publication_date) : null,
    candidate_required_location:
      row.candidate_required_location != null
        ? String(row.candidate_required_location)
        : null,
    salary: row.salary != null ? String(row.salary) : null,
    search: row.search != null ? String(row.search) : null,
  };
}

/** Context for resume tailoring — Coral omits HTML descriptions by design. */
export function jobContextForResume(job: RemotiveJob): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company_name}`,
    job.tags ? `Tags: ${job.tags}` : null,
    job.salary ? `Salary: ${job.salary}` : null,
    job.candidate_required_location
      ? `Location: ${job.candidate_required_location}`
      : null,
    job.search ? `Search index: ${job.search}` : null,
    `Full listing: ${job.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildKeywordClauses(query: string, skills: string[]): string {
  const terms = [
    ...query
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2),
    ...skills.map((s) => s.trim()).filter(Boolean),
  ];

  if (terms.length === 0) {
    return 'TRUE';
  }

  return terms
    .map((term) => {
      const safe = escapeSqlLiteral(term);
      return `(search ILIKE '%${safe}%' OR title ILIKE '%${safe}%')`;
    })
    .join(' OR ');
}

function buildSearchSql(options: {
  query: string;
  category?: string | null;
  skills?: string[];
  limit: number;
}): string {
  const category = escapeSqlLiteral(toCoralCategory(options.category));
  const keywordWhere = buildKeywordClauses(options.query, options.skills ?? []);
  const limit = Math.min(Math.max(options.limit, 1), 10);

  return `
    SELECT ${REMOTIVE_JOBS_SELECT}
    FROM remotive.jobs
    WHERE category ILIKE '%${category}%'
      AND (${keywordWhere})
    ORDER BY publication_date DESC
    LIMIT ${limit}
  `.trim();
}

export async function searchRemotiveJobs(options: {
  query: string;
  category?: string | null;
  skills?: string[];
  limit?: number;
}): Promise<RemotiveJob[]> {
  const limit = options.limit ?? 5;
  let rows = await queryCoralEngine(
    buildSearchSql({ ...options, limit })
  );

  if (rows.length === 0 && options.query.trim()) {
    const fallbackSql = await generateJobSearchSQL(options.query, options.skills ?? []);
    rows = await queryCoralEngine(fallbackSql);
  }

  return rows.map(normalizeJob);
}

export async function getRemotiveJobById(jobId: number): Promise<RemotiveJob | null> {
  if (!Number.isFinite(jobId)) return null;

  const rows = await queryCoralEngine(`
    SELECT ${REMOTIVE_JOBS_SELECT}
    FROM remotive.jobs
    WHERE id = ${Math.trunc(jobId)}
    LIMIT 1
  `);

  const row = rows[0];
  return row ? normalizeJob(row) : null;
}
