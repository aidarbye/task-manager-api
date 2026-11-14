const { z } = require('zod');
const { USER_ROLES, PROJECT_STATUSES, TASK_STATUSES, TASK_PRIORITIES } = require('./models');

const id = z.coerce.number({ invalid_type_error: 'must be a number' }).int().positive();
const fkId = z.number().int().positive();
const nonEmptyPatch = (schema) => schema.partial().strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field to update' });

const idParams = z.object({ id });
const taskTagParams = z.object({ id, tagId: id });

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Users ----
const userBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(USER_ROLES).default('member'),
}).strict();

const userListQuery = pagination.extend({
  role: z.enum(USER_ROLES).optional(),
  search: z.string().trim().min(1).optional(),
});

// ---- Projects ----
const projectFields = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  ownerId: fkId,
});
const projectCreate = projectFields.strict();
const projectPatch = nonEmptyPatch(projectFields);
const projectListQuery = pagination.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
  ownerId: id.optional(),
});

// ---- Tasks ----
const taskFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().date('must be a date in YYYY-MM-DD format').nullable().optional(),
  assigneeId: fkId.nullable().optional(),
});
const taskCreate = taskFields.extend({ tagIds: z.array(fkId).max(20).optional() }).strict();
const taskPatch = nonEmptyPatch(taskFields.extend({ projectId: fkId }));
const taskListQuery = pagination.extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: id.optional(),
  projectId: id.optional(),
  search: z.string().trim().min(1).optional(),
});
const taskTagBody = z.object({ tagId: fkId }).strict();

// ---- Tags ----
const tagFields = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #ff8800').nullable().optional(),
});
const tagCreate = tagFields.strict();
const tagPatch = nonEmptyPatch(tagFields);

module.exports = {
  idParams, taskTagParams, pagination,
  userBody, userListQuery,
  projectCreate, projectPatch, projectListQuery,
  taskCreate, taskPatch, taskListQuery, taskTagBody,
  tagCreate, tagPatch,
};
