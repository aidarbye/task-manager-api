# Task Manager REST API

A REST API for managing **users, projects, tasks and tags**, built with **Node.js + Express 5**, **Sequelize ORM** and **SQLite** (a relational database stored in `data/database.sqlite`). Request validation uses **Zod**.

## Quick start

```bash
npm install
npm run seed      # (optional) reset the database and load sample data
npm start         # http://localhost:3000/api
npm test          # runs the Postman collection with newman against a fresh in-memory DB
```

Environment variables: `PORT` (default `3000`), `DB_FILE` (default `data/database.sqlite`, use `:memory:` for a throwaway DB), `DB_LOGGING=true` to print SQL.

## Data model

```
User 1 ──< owns >── * Project 1 ──< has >── * Task * ──< tagged >── * Tag
User 1 ──< assigned >────────────────────── * Task
```

| Entity  | Fields | Relationships |
|---------|--------|---------------|
| **User**    | `id`, `name` (1–100), `email` (unique), `role` (`admin` \| `member`, default `member`) | owns many Projects (1‑N); assigned many Tasks (1‑N) |
| **Project** | `id`, `name` (1–150), `description?`, `status` (`active` \| `archived`, default `active`), `ownerId` → User | belongs to owner User; has many Tasks (1‑N, cascade delete) |
| **Task**    | `id`, `title` (1–200), `description?`, `status` (`todo` \| `in_progress` \| `done`), `priority` (`low` \| `medium` \| `high`), `dueDate?` (`YYYY-MM-DD`), `projectId` → Project, `assigneeId?` → User | belongs to Project; optional assignee User; many‑to‑many with Tag |
| **Tag**     | `id`, `name` (unique, 1–50), `color?` (`#rrggbb`) | many‑to‑many with Task via `task_tags` |

All records also have `createdAt` / `updatedAt`.

Delete rules: deleting a **project** deletes its tasks; deleting a **user** unassigns their tasks but is refused (409) while they own projects; deleting a **tag** detaches it from tasks.

## Conventions

- Base URL: `http://localhost:3000/api`. Request/response bodies are JSON (`Content-Type: application/json`).
- Path ids must be positive integers, otherwise `400`.
- Unknown body fields are rejected with `400`.
- **List endpoints** accept `page` (≥1, default 1) and `limit` (1–100, default 20) and return:
  ```json
  { "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
  ```
- Task objects are always returned with their `project` (`id`, `name`), `assignee` (`id`, `name`, `email` or `null`) and `tags` (`id`, `name`, `color`) embedded.

### Status codes and error format

| Code | When |
|------|------|
| `200 OK` | Successful read / update |
| `201 Created` | Resource created (also sets a `Location` header) or tag attached |
| `204 No Content` | Successful delete |
| `400 Bad Request` | Validation failure, malformed JSON, invalid id, reference to a non‑existent related resource |
| `404 Not Found` | Resource or route does not exist |
| `409 Conflict` | Unique value already used, tag already attached, user still owns projects, adding a task to an archived project |
| `500 Internal Server Error` | Unexpected error |

Every error has the same shape:

```json
{
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": [
    { "field": "email", "message": "Invalid email" },
    { "field": "role", "message": "Invalid enum value. Expected 'admin' | 'member', received 'boss'" }
  ]
}
```
`error` is one of `ValidationError`, `BadRequest`, `NotFound`, `Conflict`, `InternalServerError`; `details` is present only when there is per‑field information.

## Endpoints

Summary (26 endpoints):

| # | Method | URL | Description |
|---|--------|-----|-------------|
| 1 | GET | `/health` | Health check |
| 2 | GET | `/users` | List users |
| 3 | POST | `/users` | Create user |
| 4 | GET | `/users/{id}` | Get user |
| 5 | PUT | `/users/{id}` | Replace user |
| 6 | DELETE | `/users/{id}` | Delete user |
| 7 | GET | `/users/{id}/projects` | Projects owned by user |
| 8 | GET | `/users/{id}/tasks` | Tasks assigned to user |
| 9 | GET | `/projects` | List projects |
| 10 | POST | `/projects` | Create project |
| 11 | GET | `/projects/{id}` | Get project with task stats |
| 12 | PATCH | `/projects/{id}` | Update project |
| 13 | DELETE | `/projects/{id}` | Delete project (and its tasks) |
| 14 | GET | `/projects/{id}/tasks` | Tasks in project |
| 15 | POST | `/projects/{id}/tasks` | Create task in project |
| 16 | GET | `/tasks` | List / filter all tasks |
| 17 | GET | `/tasks/{id}` | Get task |
| 18 | PATCH | `/tasks/{id}` | Update task |
| 19 | DELETE | `/tasks/{id}` | Delete task |
| 20 | POST | `/tasks/{id}/tags` | Attach tag to task |
| 21 | DELETE | `/tasks/{id}/tags/{tagId}` | Detach tag from task |
| 22 | GET | `/tags` | List tags |
| 23 | POST | `/tags` | Create tag |
| 24 | PATCH | `/tags/{id}` | Update tag |
| 25 | DELETE | `/tags/{id}` | Delete tag |
| 26 | GET | `/tags/{id}/tasks` | Tasks with tag |

---

### Health

#### `GET /health`
Response `200`: `{ "status": "ok" }`

---

### Users

#### `GET /users`
Query: `page`, `limit`, `role` (`admin`|`member`), `search` (matches name or email).
Response `200`: paginated list of users.
```json
{ "data": [ { "id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin",
              "createdAt": "2026-11-14T09:35:20.322Z", "updatedAt": "2026-11-14T09:35:20.322Z" } ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }
```
Errors: `400` invalid query.

#### `POST /users`
Body:
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 1–100 chars, trimmed |
| `email` | string | yes | valid email, lower‑cased, unique |
| `role` | string | no | `admin` \| `member` (default `member`) |

```json
{ "name": "Dana Lee", "email": "dana@example.com", "role": "admin" }
```
Response `201`: the created user. Errors: `400` validation, `409` email already exists.

#### `GET /users/{id}`
Response `200`: user plus `projectCount` and `assignedTaskCount`.
```json
{ "id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin",
  "createdAt": "...", "updatedAt": "...", "projectCount": 1, "assignedTaskCount": 0 }
```
Errors: `400` invalid id, `404` not found.

#### `PUT /users/{id}`
Full replacement. Body: same as `POST /users` (`name` and `email` required; `role` resets to `member` if omitted).
Response `200`: updated user. Errors: `400`, `404`, `409` email taken.

#### `DELETE /users/{id}`
Response `204`. Tasks assigned to the user become unassigned.
Errors: `404`, `409` if the user still owns projects.

#### `GET /users/{id}/projects`
Query: `page`, `limit`. Response `200`: paginated list of projects whose `ownerId` is `{id}`. Errors: `404` user not found.

#### `GET /users/{id}/tasks`
Query: `page`, `limit`. Response `200`: paginated list of tasks assigned to the user (with embedded project/assignee/tags). Errors: `404` user not found.

---

### Projects

#### `GET /projects`
Query: `page`, `limit`, `status` (`active`|`archived`), `ownerId`.
Response `200`: paginated list; each project embeds `owner` (`id`, `name`, `email`).

#### `POST /projects`
Body:
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 1–150 chars |
| `description` | string \| null | no | ≤ 2000 chars |
| `status` | string | no | `active` \| `archived` (default `active`) |
| `ownerId` | integer | yes | must reference an existing user |

```json
{ "name": "API Platform", "description": "Public REST API", "ownerId": 1 }
```
Response `201`:
```json
{ "id": 3, "name": "API Platform", "description": "Public REST API", "status": "active", "ownerId": 1,
  "createdAt": "...", "updatedAt": "...", "owner": { "id": 1, "name": "Alice Johnson", "email": "alice@example.com" } }
```
Errors: `400` validation or unknown `ownerId`.

#### `GET /projects/{id}`
Response `200`: project with `owner` and `taskStats`.
```json
{ "id": 1, "name": "Website Redesign", "status": "active", "ownerId": 1, "owner": { ... },
  "taskStats": { "todo": 1, "in_progress": 1, "done": 0, "total": 2 } }
```
Errors: `400`, `404`.

#### `PATCH /projects/{id}`
Body: any non‑empty subset of `name`, `description`, `status`, `ownerId` (same rules as create).
```json
{ "status": "archived" }
```
Response `200`: updated project with `owner`. Errors: `400` (incl. empty body / unknown `ownerId`), `404`.

#### `DELETE /projects/{id}`
Response `204`. All tasks of the project are deleted too. Errors: `404`.

#### `GET /projects/{id}/tasks`
Query: `page`, `limit`, `status`, `priority`, `assigneeId`, `search` (title contains).
Response `200`: paginated tasks of the project. Errors: `404` project not found.

#### `POST /projects/{id}/tasks`
Body:
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `title` | string | yes | 1–200 chars |
| `description` | string \| null | no | ≤ 5000 chars |
| `status` | string | no | `todo` \| `in_progress` \| `done` (default `todo`) |
| `priority` | string | no | `low` \| `medium` \| `high` (default `medium`) |
| `dueDate` | string \| null | no | `YYYY-MM-DD` |
| `assigneeId` | integer \| null | no | must reference an existing user |
| `tagIds` | integer[] | no | up to 20 existing tag ids |

```json
{ "title": "Write endpoint docs", "priority": "high", "dueDate": "2026-12-31", "assigneeId": 2, "tagIds": [1] }
```
Response `201`:
```json
{ "id": 5, "title": "Write endpoint docs", "description": null, "status": "todo", "priority": "high",
  "dueDate": "2026-12-31", "projectId": 3, "assigneeId": 2, "createdAt": "...", "updatedAt": "...",
  "project": { "id": 3, "name": "API Platform" },
  "assignee": { "id": 2, "name": "Bob Smith", "email": "bob@example.com" },
  "tags": [ { "id": 1, "name": "bug", "color": "#d73a4a" } ] }
```
Errors: `400` validation / unknown assignee / unknown tag ids, `404` project not found, `409` project is archived.

---

### Tasks

#### `GET /tasks`
Query: `page`, `limit`, `status`, `priority`, `assigneeId`, `projectId`, `search` (title contains).
Response `200`: paginated tasks with embedded `project`, `assignee`, `tags`.

#### `GET /tasks/{id}`
Response `200`: one task (same shape as above). Errors: `400`, `404`.

#### `PATCH /tasks/{id}`
Body: any non‑empty subset of `title`, `description`, `status`, `priority`, `dueDate`, `assigneeId` (use `null` to unassign), `projectId` (move to another project).
```json
{ "status": "done", "assigneeId": null }
```
Response `200`: updated task. Errors: `400` (incl. unknown `assigneeId`/`projectId`), `404`.

#### `DELETE /tasks/{id}`
Response `204`. Errors: `404`.

#### `POST /tasks/{id}/tags`
Body: `{ "tagId": 2 }` (integer, required, existing tag).
Response `201`: the task with its updated `tags`. Errors: `400` validation / unknown tag, `404` task not found, `409` tag already attached.

#### `DELETE /tasks/{id}/tags/{tagId}`
Response `204`. Errors: `404` task not found or tag not attached to the task.

---

### Tags

#### `GET /tags`
Query: `page`, `limit`. Response `200`: paginated tags sorted by name.

#### `POST /tags`
Body:
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 1–50 chars, unique |
| `color` | string \| null | no | hex color `#rrggbb` |

```json
{ "name": "backend", "color": "#1d76db" }
```
Response `201`: `{ "id": 4, "name": "backend", "color": "#1d76db", "createdAt": "...", "updatedAt": "..." }`
Errors: `400`, `409` name exists.

#### `PATCH /tags/{id}`
Body: non‑empty subset of `name`, `color`. Response `200`: updated tag. Errors: `400`, `404`, `409`.

#### `DELETE /tags/{id}`
Response `204` (the tag is removed from all tasks). Errors: `404`.

#### `GET /tags/{id}/tasks`
Query: `page`, `limit`. Response `200`: paginated tasks carrying the tag. Errors: `404` tag not found.

## Postman collection

`postman/Task-Manager-API.postman_collection.json` contains a request for every endpoint plus error examples (41 requests, each with tests).

1. Start the server (`npm start`).
2. In Postman: **Import** → select the file.
3. Run the collection with the **Collection Runner** (or open requests one by one in order). The `baseUrl` collection variable defaults to `http://localhost:3000/api`; requests save the ids they create (`userId`, `projectId`, `taskId`, `tagId`, …) so later requests use them, and the *Cleanup* folder deletes everything that was created. It works on an empty or seeded database.

`npm test` runs the same collection headlessly with newman.

## Project structure

```
src/
  app.js                 Express app, route mounting, 404 + error handler
  server.js              Syncs DB schema and starts the HTTP server
  db.js                  Sequelize / SQLite connection
  models/index.js        User, Project, Task, Tag models and associations
  validation.js          Zod schemas for params, query and bodies
  middleware/validate.js Applies schemas to requests
  middleware/errorHandler.js  Maps errors to HTTP responses
  routes/                users, projects, tasks, tags routers
  seed.js                Sample data
postman/                 Postman collection
scripts/run-postman-tests.js  newman runner used by `npm test`
```
