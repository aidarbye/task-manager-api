const router = require('express').Router();
const { Op } = require('sequelize');
const { User, Project, Task, Tag } = require('../models');
const validate = require('../middleware/validate');
const v = require('../validation');
const { findOr404, assertExists, paginate } = require('../utils');
const { ApiError } = require('../errors');
const { taskIncludes } = require('./includes');

// GET /tasks — list tasks across projects with filters
router.get('/', validate({ query: v.taskListQuery }), async (req, res) => {
  const { status, priority, assigneeId, projectId, search, ...page } = req.valid.query;
  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;
  if (projectId) where.projectId = projectId;
  if (search) where.title = { [Op.like]: `%${search}%` };
  res.json(await paginate(Task, page, { where, include: taskIncludes }));
});

// GET /tasks/:id — one task with project, assignee and tags
router.get('/:id', validate({ params: v.idParams }), async (req, res) => {
  res.json(await findOr404(Task, req.valid.params.id, { include: taskIncludes }));
});

// PATCH /tasks/:id — partial update (can move to another project or reassign)
router.patch('/:id', validate({ params: v.idParams, body: v.taskPatch }), async (req, res) => {
  const task = await findOr404(Task, req.valid.params.id);
  await assertExists(User, req.valid.body.assigneeId, 'assigneeId');
  await assertExists(Project, req.valid.body.projectId, 'projectId');
  await task.update(req.valid.body);
  await task.reload({ include: taskIncludes });
  res.json(task);
});

// DELETE /tasks/:id
router.delete('/:id', validate({ params: v.idParams }), async (req, res) => {
  const task = await findOr404(Task, req.valid.params.id);
  await task.destroy();
  res.status(204).end();
});

// POST /tasks/:id/tags — attach an existing tag to a task
router.post('/:id/tags', validate({ params: v.idParams, body: v.taskTagBody }), async (req, res) => {
  const task = await findOr404(Task, req.valid.params.id);
  await assertExists(Tag, req.valid.body.tagId, 'tagId');
  if (await task.hasTag(req.valid.body.tagId)) {
    throw new ApiError(409, `Tag ${req.valid.body.tagId} is already attached to task ${task.id}`);
  }
  await task.addTag(req.valid.body.tagId);
  await task.reload({ include: taskIncludes });
  res.status(201).json(task);
});

// DELETE /tasks/:id/tags/:tagId — detach a tag from a task
router.delete('/:id/tags/:tagId', validate({ params: v.taskTagParams }), async (req, res) => {
  const { id, tagId } = req.valid.params;
  const task = await findOr404(Task, id);
  if (!(await task.hasTag(tagId))) {
    throw new ApiError(404, `Tag ${tagId} is not attached to task ${id}`);
  }
  await task.removeTag(tagId);
  res.status(204).end();
});

module.exports = router;
