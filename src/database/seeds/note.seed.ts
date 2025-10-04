// src/database/seeds/note.seed.ts
import { Note } from '../../typeorm/entities/Note';
import { DataSource } from 'typeorm';
import { Task } from '../../typeorm/entities/Task';
import { User } from '../../typeorm/entities/User';

export const noteSeedData = [
  { note: 'Urgent - needs immediate attention', color: '#FF4D4D' },
  { note: 'Important but not urgent', color: '#FFD700' },
  { note: 'Quick win task', color: '#32CD32' },
  { note: 'Currently in progress', color: '#1E90FF' },
  { note: 'Blocked due to dependency', color: '#8B0000' },
  { note: 'Low priority - can handle later', color: '#A9A9A9' },
  { note: 'Requires meeting discussion', color: '#9370DB' },
  { note: 'Research task - investigate topic', color: '#20B2AA' },
  { note: 'Documentation-related work', color: '#FF8C00' },
  { note: 'Bug to be fixed', color: '#DC143C' },
  { note: 'New feature development', color: '#4169E1' },
  { note: 'Improvement on existing feature', color: '#3CB371' },
  { note: 'Personal reminder', color: '#9932CC' },
  { note: 'Weekend task', color: '#FF1493' },
  { note: 'Planning-related activity', color: '#708090' },
];

export const seedNotes = async (dataSource: DataSource) => {
  const noteRepository = dataSource.getRepository(Note);
  const taskRepository = dataSource.getRepository(Task);

  const allTasks = await taskRepository.find();

  // Optional: clear existing notes
  await noteRepository.delete({});

  for (const data of noteSeedData) {
    // const randomUserId = Math.floor(Math.random() * 3) + 1;
    const randomUserId = 1;

    // Random 1–2 categories
    const randomTask =
      allTasks.length > 0
        ? allTasks[Math.floor(Math.random() * allTasks.length)]
        : null;

    const isPinned = Math.random() < 0.3; // 30% chance to be pinned
    const position = {
      x: Math.floor(Math.random() * 500),
      y: Math.floor(Math.random() * 300),
    };


    const note = noteRepository.create({
      note: data.note,
      color: data.color,
      is_pinned: isPinned,
      position,
      user: { id: randomUserId } as User,
      task: randomTask as Task,
    });

    await noteRepository.save(note);
  }

  console.log('Notes with taks seeded successfully');
};
