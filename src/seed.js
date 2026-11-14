const { sequelize, User, Project, Task, Tag } = require('./models');

async function seed() {
  await sequelize.sync({ force: true }); // drops and recreates all tables

  const [alice, bob, carol] = await User.bulkCreate([
    { name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
    { name: 'Bob Smith', email: 'bob@example.com' },
    { name: 'Carol White', email: 'carol@example.com' },
  ]);

  const [bug, feature, urgent] = await Tag.bulkCreate([
    { name: 'bug', color: '#d73a4a' },
    { name: 'feature', color: '#0e8a16' },
    { name: 'urgent', color: '#fbca04' },
  ]);

  const website = await Project.create({ name: 'Website Redesign', description: 'New marketing site', ownerId: alice.id });
  const mobile = await Project.create({ name: 'Mobile App', description: 'iOS and Android client', ownerId: bob.id });

  const t1 = await Task.create({ title: 'Design landing page', status: 'in_progress', priority: 'high', dueDate: '2026-12-01', projectId: website.id, assigneeId: carol.id });
  const t2 = await Task.create({ title: 'Fix broken nav links', priority: 'high', projectId: website.id, assigneeId: bob.id });
  const t3 = await Task.create({ title: 'Set up push notifications', projectId: mobile.id, assigneeId: bob.id });
  await Task.create({ title: 'Write release notes', status: 'done', priority: 'low', projectId: mobile.id });

  await t1.setTags([feature]);
  await t2.setTags([bug, urgent]);
  await t3.setTags([feature]);

  console.log('Database seeded: 3 users, 2 projects, 4 tasks, 3 tags');
}

seed().then(() => sequelize.close()).catch((err) => { console.error(err); process.exit(1); });
