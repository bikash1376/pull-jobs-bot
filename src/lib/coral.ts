/**
 * Coral SQL client. Job listings use the community Remotive source (`remotive.jobs`).
 * User profiles and applications stay in Prisma/Neon — not in Coral bundled/community sources.
 *
 * Coral 0.4+ runs queries via the CLI (`coral sql`), not `coral serve`.
 * @see https://withcoral.com/docs/reference/cli-reference
 * @see https://github.com/withcoral/coral/tree/main/sources/community/remotive
 */
import { spawn } from 'node:child_process';
import { generateText } from 'ai';
import { chatModel } from '@/lib/ai';

/** Columns exposed by the Remotive community source (description is not included). */
export const REMOTIVE_JOBS_SELECT = `
  id, title, company_name, url, category, tags, job_type,
  publication_date, candidate_required_location, salary, search
`.trim();

function resolveCoralExecutable(): string {
  return (/* turbopackIgnore: true */ process.env.CORAL_BIN) ?? 'coral';
}

/**
 * Runs SQL through the local Coral CLI (`coral sql --format json`).
 * Requires: `coral source add --file coral/remotive.manifest.yaml`
 */
export async function queryCoralEngine(sqlStatement: string): Promise<Record<string, unknown>[]> {
  const coralBin = resolveCoralExecutable();
  const sql = sqlStatement.trim();

  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn(coralBin, ['sql', sql, '--format', 'json'], {
      env: process.env,
      windowsHide: true,
    });

    let out = '';
    let err = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString();
    });

    proc.on('error', (error) => {
      reject(
        new Error(
          `Could not run Coral (${coralBin}). Install the CLI and add Remotive: ${error.message}`
        )
      );
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            err.trim() ||
              out.trim() ||
              `coral sql failed (exit ${code}). Run: coral source add --file coral/remotive.manifest.yaml`
          )
        );
        return;
      }
      resolve(out);
    });
  });

  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Unexpected Coral output (expected JSON array)');
    }
    return parsed as Record<string, unknown>[];
  } catch {
    throw new Error(`Failed to parse Coral JSON output: ${trimmed.slice(0, 200)}`);
  }
}

/**
 * LLM-generated Coral SQL for complex job intents (fallback when structured search returns nothing).
 */
export async function generateJobSearchSQL(intent: string, userSkills: string[]): Promise<string> {
  const { text } = await generateText({
    model: chatModel,
    prompt: `
      Convert this job search intent into Coral SQL for table remotive.jobs.

      Available columns: id, title, company_name, url, category, tags, job_type,
      publication_date, candidate_required_location, salary, search

      Notes:
      - There is NO description column; use search, title, and tags with ILIKE.
      - category values look like 'Software Development', 'Marketing', 'Design' (title case).
      - The virtual "search" column combines title, company, tags, and category.
      - API filters run locally in Coral; always include LIMIT 5.

      User intent: "${intent}"
      User skills: ${userSkills.join(', ') || 'none'}

      Return ONLY the SQL string.
    `,
  });

  return text.trim().replace(/^```sql?\s*/i, '').replace(/```\s*$/i, '');
}
