import { UserPeerStatus } from 'src/utils/constants/userPeerEnums';
import { UserPeer } from '../../typeorm/entities/UserPeer';
import { DataSource } from 'typeorm';

export const userPeersData = [
  {
    user: { id: 1 },
    peer: { id: 2 },
    status: UserPeerStatus.BLOCKED,
    notes: 'Known from school',
    is_confirmed: true,
    connection_type: '',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 3 },
    status: UserPeerStatus.PENDING,
    notes: 'Requested connection',
    is_confirmed: false,
    connection_type: '',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 4 },
    status: UserPeerStatus.CONNECTED,
    notes: 'Blocked due to spamming',
    is_confirmed: false,
    connection_type: '',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 5 },
    status: UserPeerStatus.CONNECTED,
    notes: 'Group project teammate',
    is_confirmed: true,
    connection_type: '',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 6 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 7 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 8 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 9 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 10 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 11 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    user: { id: 1 },
    peer: { id: 12 },
    status: UserPeerStatus.CONNECTED,
    notes: null,
    is_confirmed: true,
    connection_type: 'mentor',
    created_at: new Date(),
    updated_at: new Date(),
  },
];

export const seedUserPeers = async (dataSource: DataSource) => {
  const userPeersRepository = dataSource.getRepository(UserPeer);

  // Clear existing user peers (optional)
  await userPeersRepository.delete({});

  // Insert peer
  for (const peer of userPeersData) {
    await userPeersRepository.save(userPeersRepository.create(peer));
  }

  console.log('Peers seeded successfully');
};
