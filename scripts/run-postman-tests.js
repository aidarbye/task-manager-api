// Starts the API on a throwaway in-memory database and runs the Postman collection against it with newman.
process.env.DB_FILE = ':memory:';
const path = require('path');
const newman = require('newman');
const app = require('../src/app');
const { sequelize } = require('../src/models');

(async () => {
  await sequelize.sync();
  const server = app.listen(0);
  const { port } = server.address();
  newman.run({
    collection: require(path.join(__dirname, '..', 'postman', 'Task-Manager-API.postman_collection.json')),
    envVar: [{ key: 'baseUrl', value: `http://localhost:${port}/api` }],
    reporters: 'cli',
  }, (err, summary) => {
    server.close();
    const failed = err || summary.run.failures.length > 0;
    process.exit(failed ? 1 : 0);
  });
})();
