const { ZodError } = require('zod');
const { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } = require('sequelize');
const { ApiError } = require('../errors');

function send(res, status, error, message, details) {
  const body = { error, message };
  if (details) body.details = details;
  res.status(status).json(body);
}

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return send(res, 400, 'ValidationError', 'Request validation failed',
      err.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })));
  }
  if (err instanceof ApiError) {
    return send(res, err.status, err.status === 404 ? 'NotFound' : err.status === 409 ? 'Conflict' : 'BadRequest',
      err.message, err.details);
  }
  if (err.type === 'entity.parse.failed') {
    return send(res, 400, 'BadRequest', 'Malformed JSON in request body');
  }
  if (err instanceof UniqueConstraintError) {
    return send(res, 409, 'Conflict', 'A resource with the same unique value already exists',
      err.errors.map((e) => ({ field: e.path, message: `${e.path} must be unique` })));
  }
  if (err instanceof ForeignKeyConstraintError) {
    return send(res, 409, 'Conflict', 'Operation violates a relationship constraint');
  }
  if (err instanceof ValidationError) {
    return send(res, 400, 'ValidationError', 'Request validation failed',
      err.errors.map((e) => ({ field: e.path, message: e.message })));
  }
  console.error(err);
  return send(res, 500, 'InternalServerError', 'Something went wrong');
};
