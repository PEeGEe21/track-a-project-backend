// src/database/seeds/global-menu.seed.ts

import { DataSource } from 'typeorm';
import { GlobalMenu } from '../../typeorm/entities/GlobalMenu';
import { SubscriptionTier } from '../../utils/constants/subscriptionTier';

export const globalMenuSeedData = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'layout-dashboard',
    order_index: 0,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: 'folder-kanban',
    order_index: 1,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Peers',
    href: '/peers',
    icon: 'users',
    order_index: 2,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Notes',
    href: '/notes',
    icon: 'sticky-note',
    order_index: 3,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: 'message-circle',
    order_index: 4,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Whiteboards',
    href: '/whiteboards',
    icon: 'frame',
    order_index: 5,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'AI Overview',
    href: '/ai-overview',
    icon: 'sparkles',
    order_index: 6,
    is_active: false,
    required_tier: SubscriptionTier.PROFESSIONAL,
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: 'files',
    order_index: 7,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Folders',
    href: '/folders',
    icon: 'folder-open',
    order_index: 8,
    is_active: true,
    required_tier: SubscriptionTier.FREE,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: 'bar-chart-3',
    order_index: 9,
    is_active: false,
    required_tier: SubscriptionTier.PROFESSIONAL,
  }
  // {
  //   label: 'Settings',
  //   href: '/settings',
  //   icon: 'settings',
  //   order_index: 10,
  //   is_active: true,
  //   required_tier: SubscriptionTier.FREE,
  // },
];

export const seedGlobalMenus = async (dataSource: DataSource) => {
  const menuRepo = dataSource.getRepository(GlobalMenu);

  // Optional: clear existing menus
  await menuRepo.delete({});

  const menus = menuRepo.create(globalMenuSeedData);

  await menuRepo.save(menus);

  console.log('Global menus seeded successfully');
};
