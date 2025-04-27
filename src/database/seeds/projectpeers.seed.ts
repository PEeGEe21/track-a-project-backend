import { ProjectPeer } from '../../typeorm/entities/ProjectPeers';
import { DataSource } from 'typeorm';

// Example seed data
const projectPeersData = [
  {
    user: { id: 1 },       // User entity reference
    project: { id: 9 },    // Project entity reference
    addedBy: { id: 2 },    // User who added the peer
  },
  {
    user: { id: 1 },
    project: { id: 3 },
    addedBy: { id: 2 },
  },
  {
    user: { id: 2 },
    project: { id: 10 },
    addedBy: { id: 3 },
  },
  // Add more records as needed
];

export const seedProjectPeers = async (dataSource: DataSource) => {
  const projectPeersRepository = dataSource.getRepository(ProjectPeer);

  // Optional: Clear existing project peers
  await projectPeersRepository.delete({});

  // Insert new peers
  for (const peer of projectPeersData) {
    await projectPeersRepository.save(projectPeersRepository.create(peer));
  }

  console.log('Project peers seeded successfully');
};
