const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const USER_ROLES = ['admin', 'member'];
const PROJECT_STATUSES = ['active', 'archived'];
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
  role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: 'member' },
}, { tableName: 'users' });

const Project = sequelize.define('Project', {
  name: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM(...PROJECT_STATUSES), allowNull: false, defaultValue: 'active' },
}, { tableName: 'projects' });

const Task = sequelize.define('Task', {
  title: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM(...TASK_STATUSES), allowNull: false, defaultValue: 'todo' },
  priority: { type: DataTypes.ENUM(...TASK_PRIORITIES), allowNull: false, defaultValue: 'medium' },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: 'tasks' });

const Tag = sequelize.define('Tag', {
  name: { type: DataTypes.STRING(50), allowNull: false, unique: true, validate: { notEmpty: true } },
  color: { type: DataTypes.STRING(7), allowNull: true },
}, { tableName: 'tags' });

const TaskTag = sequelize.define('TaskTag', {}, { tableName: 'task_tags', timestamps: false });

// One-to-many: a User owns many Projects.
User.hasMany(Project, { as: 'projects', foreignKey: { name: 'ownerId', allowNull: false }, onDelete: 'RESTRICT' });
Project.belongsTo(User, { as: 'owner', foreignKey: { name: 'ownerId', allowNull: false } });

// One-to-many: a Project has many Tasks (tasks are deleted with their project).
Project.hasMany(Task, { as: 'tasks', foreignKey: { name: 'projectId', allowNull: false }, onDelete: 'CASCADE' });
Task.belongsTo(Project, { as: 'project', foreignKey: { name: 'projectId', allowNull: false } });

// One-to-many (optional): a User is assigned many Tasks (unassigned if the user is deleted).
User.hasMany(Task, { as: 'assignedTasks', foreignKey: { name: 'assigneeId', allowNull: true }, onDelete: 'SET NULL' });
Task.belongsTo(User, { as: 'assignee', foreignKey: { name: 'assigneeId', allowNull: true } });

// Many-to-many: Tasks <-> Tags through task_tags.
Task.belongsToMany(Tag, { as: 'tags', through: TaskTag, foreignKey: 'taskId', otherKey: 'tagId' });
Tag.belongsToMany(Task, { as: 'tasks', through: TaskTag, foreignKey: 'tagId', otherKey: 'taskId' });

module.exports = {
  sequelize, User, Project, Task, Tag, TaskTag,
  USER_ROLES, PROJECT_STATUSES, TASK_STATUSES, TASK_PRIORITIES,
};
