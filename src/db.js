const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

const storage = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'database.sqlite');
if (storage !== ':memory:') fs.mkdirSync(path.dirname(storage), { recursive: true });

// Sequelize enables `PRAGMA foreign_keys = ON` for SQLite, so ON DELETE rules are enforced.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
});

module.exports = sequelize;
