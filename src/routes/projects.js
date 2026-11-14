const router = require('express').Router();
const { Op } = require('sequelize');
const { User, Project, Task, Tag, sequelize, TASK_STATUSES } = require('../models');
const validate = require('../middleware/validate');
const v = require('../validation');
const { findOr404, assertExists, paginate } = require('../utils');
const { ApiError } = require('../errors');
const { taskIncludes } = require('./includes');

const ownerInclude = { model: User, as: 'owner', attributes: ['id', 'name', 'email'] };

// GET /projects — list projects (filter by status, ownerId)
router.get('/', validate({ query: v.projectListQuery }), async (req, res) => {
  const { status, ownerId, ...page } = req.valid.query;
  const where = {};
  if (status) where.status = status;
  if (ownerId) where.ownerId = ownerId;
  res.json(await paginate(Project, page, { where, include: [ownerInclude] }));
});

// POST /projects — create a project
router.post('/', validate({ body: v.projectCreate }), async (req, res) => {
  await assertExists(User, req.valid.body.ownerId, 'ownerId');
  const project = await Project.create(req.valid.body);
  await project.reload({ include: [ownerInclude] });
  res.status(201).location(`/api/projects/${project.id}`).json(project);
});

// GET /projects/:id — one project with owner and task statistics
router.get('/:id', validate({ params: v.idParams }), async (req, res) => {
  const project = await findOr404(Project, req.valid.params.id, { include: [ownerInclude] });
  const counts = await Task.count({ where: { projectId: project.id }, group: ['status'] });
  const taskStats = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0]));
  counts.forEach((c) => { taskStats[c.status] = c.count; });
  taskStats.total = Object.values(taskStats).reduce((a, b) => a + b, 0);
  res.json({ ...project.toJSON(), taskStats });
});

// PATCH /projects/:id — partial update
router.patch('/:id', validate({ params: v.idParams, body: v.projectPatch }), async (req, res) => {
  const project = await findOr404(Project, req.valid.params.id);
  await assertExists(User, req.valid.body.ownerId, 'ownerId');
  await project.update(req.valid.body);
  await project.reload({ include: [ownerInclude] });
  res.json(project);
});

// DELETE /projects/:id — deletes the project and all its tasks
router.delete('/:id', validate({ params: v.idParams }), async (req, res) => {
  const project = await findOr404(Project, req.valid.params.id);
  await project.destroy();
  res.status(204).end();
});

// GET /projects/:id/tasks — tasks in the project
router.get('/:id/tasks', validate({ params: v.idParams, query: v.taskListQuery.omit({ projectId: true }) }), async (req, res) => {
  await findOr404(Project, req.valid.params.id);
  const { status, priority, assigneeId, search, ...page } = req.valid.query;
  const where = { projectId: req.valid.params.id };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;
  if (search) where.title = { [Op.like]: `%${search}%` };
  res.json(await paginate(Task, page, { where, include: taskIncludes }));
});

// POST /projects/:id/tasks — create a task inside the project
router.post('/:id/tasks', validate({ params: v.idParams, body: v.taskCreate }), async (req, res) => {
  const project = await findOr404(Project, req.valid.params.id);
  if (project.status === 'archived') {
    throw new ApiError(409, 'Cannot add tasks to an archived project');
  }
  const { tagIds = [], ...fields } = req.valid.body;
  await assertExists(User, fields.assigneeId, 'assigneeId');
  const uniqueTagIds = [...new Set(tagIds)];
  const tags = uniqueTagIds.length ? await Tag.findAll({ where: { id: uniqueTagIds } }) : [];
  if (tags.length !== uniqueTagIds.length) {
    const found = new Set(tags.map((t) => t.id));
    const missing = uniqueTagIds.filter((tid) => !found.has(tid));
    throw new ApiError(400, 'tagIds contains tags that do not exist', [{ field: 'tagIds', message: `Unknown tag id(s): ${missing.join(', ')}` }]);
  }
  const task = await sequelize.transaction(async (transaction) => {
    const created = await Task.create({ ...fields, projectId: project.id }, { transaction });
    if (tags.length) await created.setTags(tags, { transaction });
    return created;
  });
  await task.reload({ include: taskIncludes });
  res.status(201).location(`/api/tasks/${task.id}`).json(task);
});

module.exports = router;
