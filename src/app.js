const express = require('express');
const errorHandler = require('./middleware/errorHandler');
const { ApiError } = require('./errors');

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/tags', require('./routes/tags'));

app.use((req, res, next) => next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`)));
app.use(errorHandler);

module.exports = app;
