// Validates req.params / req.query / req.body against zod schemas.
// Parsed (coerced, trimmed, defaulted) values are exposed on req.valid.
module.exports = (schemas) => (req, res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const input = part === 'body' ? (req.body ?? {}) : req[part];
    req.valid[part] = schemas[part].parse(input); // throws ZodError -> errorHandler
  }
  next();
};
