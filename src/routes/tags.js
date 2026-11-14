const router = require('express').Router();
const { Tag, Task } = require('../models');
const validate = require('../middleware/validate');
const v = require('../validation');
const { findOr404, paginate } = require('../utils');
const { taskIncludes } = require('./includes');

// GET /tags
router.get('/', validate({ query: v.pagination }), async (req, res) => {
  res.json(await paginate(Tag, req.valid.query, { order: [['name', 'ASC']] }));
});

// POST /tags
router.post('/', validate({ body: v.tagCreate }), async (req, res) => {
  const tag = await Tag.create(req.valid.body);
  res.status(201).location(`/api/tags/${tag.id}`).json(tag);
});

// PATCH /tags/:id
router.patch('/:id', validate({ params: v.idParams, body: v.tagPatch }), async (req, res) => {
  const tag = await findOr404(Tag, req.valid.params.id);
  await tag.update(req.valid.body);
  res.json(tag);
});

// DELETE /tags/:id — also detaches the tag from all tasks
router.delete('/:id', validate({ params: v.idParams }), async (req, res) => {
  const tag = await findOr404(Tag, req.valid.params.id);
  await tag.destroy();
  res.status(204).end();
});

// GET /tags/:id/tasks — tasks carrying this tag
router.get('/:id/tasks', validate({ params: v.idParams, query: v.pagination }), async (req, res) => {
  const tag = await findOr404(Tag, req.valid.params.id);
  const ids = (await tag.getTasks({ attributes: ['id'], joinTableAttributes: [] })).map((t) => t.id);
  res.json(await paginate(Task, req.valid.query, { where: { id: ids }, include: taskIncludes }));
});

module.exports = router;
