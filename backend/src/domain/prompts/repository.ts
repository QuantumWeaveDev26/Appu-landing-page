import crypto from 'node:crypto';
import type { Queryable, TransactionalQueryable } from '../../db/types.js';
import type { ChildPrompt, CreatePromptInput, PromptCategory } from './types.js';

interface PromptRow {
  id: string;
  household_id: string;
  child_id: string;
  category: PromptCategory;
  prompt_text: string;
  icon: string;
  created_at: Date | string;
}

function mapPromptRow(row: PromptRow): ChildPrompt {
  return {
    id: row.id,
    householdId: row.household_id,
    childId: row.child_id,
    category: row.category,
    promptText: row.prompt_text,
    icon: row.icon,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  };
}

export class PromptsRepository {
  static async getPromptsByChild(
    db: Queryable,
    householdId: string,
    childId: string,
    category?: PromptCategory
  ): Promise<ChildPrompt[]> {
    let sql = `
      SELECT id, household_id, child_id, category, prompt_text, icon, created_at
      FROM child_prompts
      WHERE household_id = $1 AND child_id = $2
    `;
    const params: any[] = [householdId, childId];

    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ` ORDER BY created_at ASC, id ASC`;

    const res = await db.query<PromptRow>(sql, params);
    return res.rows.map(mapPromptRow);
  }

  static async savePrompts(
    db: Queryable,
    householdId: string,
    childId: string,
    prompts: CreatePromptInput[]
  ): Promise<ChildPrompt[]> {
    if (!prompts || prompts.length === 0) {
      return [];
    }

    const now = Date.now();
    const results: ChildPrompt[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const item = prompts[i];
      const id = crypto.randomUUID();
      const icon = item.icon || 'fa-lightbulb';
      const createdAt = new Date(now + i);

      const res = await db.query<PromptRow>(
        `INSERT INTO child_prompts (id, household_id, child_id, category, prompt_text, icon, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, household_id, child_id, category, prompt_text, icon, created_at`,
        [id, householdId, childId, item.category, item.promptText, icon, createdAt]
      );

      if (res.rows.length > 0) {
        results.push(mapPromptRow(res.rows[0]));
      }
    }

    return results;
  }

  static async clearPrompts(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<void> {
    await db.query(
      `DELETE FROM child_prompts WHERE household_id = $1 AND child_id = $2`,
      [householdId, childId]
    );
  }

  static async replacePrompts(
    db: Queryable,
    householdId: string,
    childId: string,
    prompts: CreatePromptInput[]
  ): Promise<ChildPrompt[]> {
    const runInTx = async (tx: Queryable) => {
      await PromptsRepository.clearPrompts(tx, householdId, childId);
      return await PromptsRepository.savePrompts(tx, householdId, childId, prompts);
    };

    if ('transaction' in db && typeof (db as TransactionalQueryable).transaction === 'function') {
      return await (db as TransactionalQueryable).transaction(runInTx);
    }

    return await runInTx(db);
  }
}
