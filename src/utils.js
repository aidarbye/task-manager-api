const { ApiError, notFound } = require('./errors');

async function findOr404(Model, id, options = {}) {
  const row = await Model.findByPk(id, options);
  if (!row) throw notFound(Model.name, id);
  return row;
}

// Used when a body references another resource (e.g. ownerId) — the request is invalid, not the URL.
async function assertExists(Model, id, field) {
  if (id === undefined || id === null) return;
  const row = await Model.findByPk(id, { attributes: ['id'] });
  if (!row) throw new ApiError(400, `${field} refers to a ${Model.name} that does not exist`, [
    { field, message: `${Model.name} with id ${id} not found` },
  ]);
}

async function paginate(Model, { page, limit }, options = {}) {
  const { rows, count } = await Model.findAndCountAll({
    ...options, limit, offset: (page - 1) * limit, distinct: true, order: options.order || [['id', 'ASC']],
  });
  return { data: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}

module.exports = { findOr404, assertExists, paginate };
