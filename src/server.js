const app = require('./app');
const { sequelize } = require('./models');

const PORT = Number(process.env.PORT) || 3000;

(async () => {
  await sequelize.sync(); // creates tables if they do not exist
  app.listen(PORT, () => console.log(`Task Manager API listening on http://localhost:${PORT}/api`));
})().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
