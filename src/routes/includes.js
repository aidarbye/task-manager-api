const { User, Project, Tag } = require('../models');

const taskIncludes = [
  { model: Project, as: 'project', attributes: ['id', 'name'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
  { model: Tag, as: 'tags', attributes: ['id', 'name', 'color'], through: { attributes: [] } },
];

module.exports = { taskIncludes };
