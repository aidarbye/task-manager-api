const router = require('express').Router();
const { Op } = require('sequelize');
const { User, Project, Task } = require('../models');
const validate = require('../middleware/validate');
const v = require('../validation');
const { findOr404, paginate } = require('../utils');
const { ApiError } = require('../errors');
const { taskIncludes } = require('./includes');

// GET /users — list users (filter by role, search by name/email)
router.get('/', validate({ query: v.userListQuery }), async (req, res) => {
  const { role, search, ...page } = req.valid.query;
  const where = {};
  if (role) where.role = role;
  if (search) where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }];
  res.json(await paginate(User, page, { where }));
});

// POST /users — create a user
router.post('/', validate({ body: v.userBody }), async (req, res) => {
  const user = await User.create(req.valid.body);
  res.status(201).location(`/api/users/${user.id}`).json(user);
});

// GET /users/:id — one user with project/task counts
router.get('/:id', validate({ params: v.idParams }), async (req, res) => {
  const user = await findOr404(User, req.valid.params.id);
  const [projectCount, assignedTaskCount] = await Promise.all([
    Project.count({ where: { ownerId: user.id } }),
    Task.count({ where: { assigneeId: user.id } }),
  ]);
  res.json({ ...user.toJSON(), projectCount, assignedTaskCount });
});

// PUT /users/:id — full replacement of a user's editable fields
router.put('/:id', validate({ params: v.idParams, body: v.userBody }), async (req, res) => {
  const user = await findOr404(User, req.valid.params.id);
  await user.update(req.valid.body);
  res.json(user);
});

// DELETE /users/:id — refuses while the user still owns projects
router.delete('/:id', validate({ params: v.idParams }), async (req, res) => {
  const user = await findOr404(User, req.valid.params.id);
  const owned = await Project.count({ where: { ownerId: user.id } });
  if (owned > 0) {
    throw new ApiError(409, `User owns ${owned} project(s); delete or reassign them first`);
  }
  await user.destroy(); // assigned tasks become unassigned (ON DELETE SET NULL)
  res.status(204).end();
});

// GET /users/:id/projects — projects owned by the user
router.get('/:id/projects', validate({ params: v.idParams, query: v.pagination }), async (req, res) => {
  await findOr404(User, req.valid.params.id);
  res.json(await paginate(Project, req.valid.query, { where: { ownerId: req.valid.params.id } }));
});

// GET /users/:id/tasks — tasks assigned to the user
router.get('/:id/tasks', validate({ params: v.idParams, query: v.pagination }), async (req, res) => {
  await findOr404(User, req.valid.params.id);
  res.json(await paginate(Task, req.valid.query, {
    where: { assigneeId: req.valid.params.id }, include: taskIncludes,
  }));
});

module.exports = router;
