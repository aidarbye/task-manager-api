class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const notFound = (resource, id) => new ApiError(404, `${resource} with id ${id} not found`);

module.exports = { ApiError, notFound };
