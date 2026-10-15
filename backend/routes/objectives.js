import { Router } from 'express';
import { z } from 'zod';

const objectiveSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).default(''),
    target_date: z.iso.datetime({ offset: true }),
    category: z.string().trim().min(1).max(60).default('Personnel'),
    color_theme: z.enum(['amber', 'cyan', 'emerald']).default('amber'),
  })
  .strict();

export function objectiveRoutes(db) {
  const router = Router();
  router.param('id', (req, res, next, id) => {
    if (!z.uuid().safeParse(id).success)
      return res.status(400).json({ error: 'Identifiant invalide.' });
    next();
  });
  router.get('/', async (req, res) => {
    const result = await db.query(
      'SELECT * FROM objectives WHERE user_id=$1 ORDER BY target_date ASC, created_at ASC',
      [req.user.id],
    );
    res.json(result.rows);
  });
  const validate = (req, res, next) => {
    const result = objectiveSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({
        error: 'Les informations de l’objectif sont invalides.',
        details: result.error.flatten().fieldErrors,
      });
    req.objective = result.data;
    next();
  };
  router.post('/', validate, async (req, res) => {
    const { title, description, target_date, category, color_theme } = req.objective;
    const result = await db.query(
      'INSERT INTO objectives (title, description, target_date, category, color_theme, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [title, description, target_date, category, color_theme, req.user.id],
    );
    res.status(201).json(result.rows[0]);
  });
  router.put('/:id', validate, async (req, res) => {
    const { title, description, target_date, category, color_theme } = req.objective;
    const result = await db.query(
      'UPDATE objectives SET title=$1, description=$2, target_date=$3, category=$4, color_theme=$5 WHERE id=$6 AND user_id=$7 RETURNING *',
      [title, description, target_date, category, color_theme, req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Objectif introuvable.' });
    res.json(result.rows[0]);
  });
  router.delete('/:id', async (req, res) => {
    const result = await db.query(
      'DELETE FROM objectives WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Objectif introuvable.' });
    res.status(204).end();
  });
  return router;
}
