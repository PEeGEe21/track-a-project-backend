import { DataSource } from 'typeorm';
import { User } from '../../typeorm/entities/User';
import { Project } from '../../typeorm/entities/Project';
import { Category } from '../../typeorm/entities/Category';
import { Tag } from '../../typeorm/entities/Tag';
import { Task } from '../../typeorm/entities/Task';

const taskSeedData = [
  {
    title: 'New Task 1',
    description: 'A knowledge management system for remote teams.',
  },
  {
    title: 'New Task 2',
    description: 'A personal mindfulness and habit tracker.',
  },
  {
    title: 'New Task 3',
    description: 'An educational assistant platform for coders.',
  },
  {
    title: 'New Task 4',
    description: 'A finance tracking and forecasting tool.',
  },
  {
    title: 'New Task 5',
    description: 'An all-in-one health and fitness dashboard.',
  },
];

export const seedTasks = async (dataSource: DataSource) => {
  const projectRepository = dataSource.getRepository(Project);
  const categoryRepository = dataSource.getRepository(Category);
  const tagRepository = dataSource.getRepository(Tag);
  const taskRepository = dataSource.getRepository(Task);
  const userRepository = dataSource.getRepository(User);

  const allCategories = await categoryRepository.find();
  const allTags = await tagRepository.find();
  const allUsers = await userRepository.find();
  const allProjects = await projectRepository.find();

  if (!allProjects.length) {
    console.warn('⚠️ No projects found. Tasks need projects.');
    return;
  }

  for (const data of taskSeedData) {
    // Random project
    const randomProject =
      allProjects[Math.floor(Math.random() * allProjects.length)];

    // Random user (owner)
    const randomUser = allUsers[0];
    // const randomUser =
    //   allUsers[Math.floor(Math.random() * allUsers.length)];

    // Random 1–2 categories
    const randomCategories = allCategories
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 2) + 1);

    // Random 1–3 tags
    const randomTags = allTags
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 1);

    // Random assignees (1–3 users)
    const randomAssignees = allUsers
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 1);

    const task = taskRepository.create({
      ...data,
      due_date: new Date(),
      priority: Math.floor(Math.random() * 5), // 0–4
      project: randomProject,
      user: randomUser,
      categories: randomCategories,
      tags: randomTags,
      // assignees: randomAssignees,
    });

    await taskRepository.save(task);
  }

  console.log(
    '✅ Tasks with categories, tags, and assignees seeded successfully',
  );
};
