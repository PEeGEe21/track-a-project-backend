// src/database/seeds/organization.seed.ts

import { DataSource } from 'typeorm';
import { Organization } from '../../typeorm/entities/Organization';
import { UserOrganization } from '../../typeorm/entities/UserOrganization';
import { OrganizationMenu } from '../../typeorm/entities/OrganizationMenu';
import { GlobalMenu } from '../../typeorm/entities/GlobalMenu';
import { SubscriptionTier } from '../../utils/constants/subscriptionTier';

export const seedOrganizationsAndLinks = async (dataSource: DataSource) => {
  const orgRepo = dataSource.getRepository(Organization);
  const userOrgRepo = dataSource.getRepository(UserOrganization);
  const orgMenuRepo = dataSource.getRepository(OrganizationMenu);
  const globalMenuRepo = dataSource.getRepository(GlobalMenu);

  // 1. Create a default organization
  let org = await orgRepo.findOne({ where: { slug: 'default-org' } });

  if (!org) {
    org = orgRepo.create({
      name: 'Default Organization',
      slug: 'default-org',
      subscription_tier: SubscriptionTier.FREE,
      max_users: 10,
      max_projects: 20,
      is_active: true,
    });
    await orgRepo.save(org);
    console.log('Default organization created');
  } else {
    console.log('Default organization already exists');
  }

  // 2. Link users 2, 3, 4, 5 to this organization
  const userIds = [2, 3, 4, 5];

  for (const userId of userIds) {
    const existing = await userOrgRepo.findOne({
      where: { organization: { id: org.id }, user: { id: Number(userId) } },
    });

    if (!existing) {
      const userOrg = userOrgRepo.create({
        organization_id: org.id,
        user_id: Number(userId),
      });
      await userOrgRepo.save(userOrg);
      console.log(`User ${userId} added to organization`);
    }
  }

  // 3. Enable all global menus for this organization
  const globalMenus = await globalMenuRepo.find();

  for (const globalMenu of globalMenus) {
    const existingOrgMenu = await orgMenuRepo.findOne({
      where: {
        organization: { id: org.id },
        global_menu: { id: globalMenu.id },
      },
    });

    if (!existingOrgMenu) {
      const orgMenu = orgMenuRepo.create({
        organization_id: org.id,
        global_menu_id: globalMenu.id,
        is_enabled: globalMenu.is_active, // Respect global is_active, or force true if you want
        custom_label: null,
        order_index: globalMenu.order_index,
      });
      await orgMenuRepo.save(orgMenu);
    }
  }

  console.log('Organization menus linked successfully');
};
