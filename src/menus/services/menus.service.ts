import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { CreateMenuDto } from '../dto/create-menu.dto';
import { UpdateMenuDto } from '../dto/update-menu.dto';
import { UpdateGlobalMenuDto } from '../dto/update-global-menu.dto';
import { CreateGlobalMenuDto } from '../dto/create-global-menu.dto';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';
import { UpdateOrgMenuDto } from '../dto/update-org-menu.dto';
import { GlobalMenu } from 'src/typeorm/entities/GlobalMenu';
import { OrganizationMenu } from 'src/typeorm/entities/OrganizationMenu';
import { ReorderMenusDto } from '../dto/reorder-menu.dto';

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(GlobalMenu)
    private globalMenuRepository: Repository<GlobalMenu>,
    @InjectRepository(OrganizationMenu)
    private organizationMenuRepository: Repository<OrganizationMenu>,
  ) {}
  // ============================================
  // Super Admin - Global Menu Management
  // ============================================

  // async createGlobalMenu(dto: CreateGlobalMenuDto): Promise<GlobalMenu> {
  //   const menu = this.globalMenuRepository.create(dto);
  //   return this.globalMenuRepository.save(menu);
  // }

  async createGlobalMenu(dto: CreateGlobalMenuDto): Promise<GlobalMenu> {
    // Get max order index for the parent level
    let maxOrder = 0;
    if (dto.parent_id) {
      const siblings = await this.globalMenuRepository.find({
        where: { parent_id: dto.parent_id },
      });
      maxOrder = Math.max(...siblings.map((s) => s.order_index || 0), 0);
    } else {
      const rootMenus = await this.globalMenuRepository.find({
        where: { parent_id: null },
      });
      maxOrder = Math.max(...rootMenus.map((m) => m.order_index || 0), 0);
    }

    const menu = this.globalMenuRepository.create({
      ...dto,
      order_index: dto.order_index ?? maxOrder + 1,
    });

    return this.globalMenuRepository.save(menu);
  }

  async findAllGlobalMenus(): Promise<GlobalMenu[]> {
    const menus = await this.globalMenuRepository.find({
      relations: ['children'],
      order: { order_index: 'ASC', created_at: 'ASC' },
    });
    return this.buildMenuTree(menus);
  }

  async findGlobalMenuById(id: string): Promise<GlobalMenu> {
    const menu = await this.globalMenuRepository.findOne({
      where: { id },
      relations: ['children'],
    });
    if (!menu) {
      throw new NotFoundException(`Menu with ID ${id} not found`);
    }
    return menu;
  }

  async updateGlobalMenu(
    id: string,
    dto: UpdateGlobalMenuDto,
  ): Promise<GlobalMenu> {
    const menu = await this.findGlobalMenuById(id);
    Object.assign(menu, dto);
    return this.globalMenuRepository.save(menu);
  }

  async deleteGlobalMenu(id: string): Promise<void> {
    const menu = await this.findGlobalMenuById(id);

    // Delete all children recursively
    await this.deleteMenuAndChildren(menu.id);
  }

  private async deleteMenuAndChildren(menuId: string): Promise<void> {
    // Find all children
    const children = await this.globalMenuRepository.find({
      where: { parent_id: menuId },
    });

    // Recursively delete children
    for (const child of children) {
      await this.deleteMenuAndChildren(child.id);
    }

    // Delete the menu itself
    await this.globalMenuRepository.delete(menuId);
  }

  // async deleteGlobalMenu(id: string): Promise<void> {
  //   const menu = await this.findGlobalMenuById(id);
  //   await this.globalMenuRepository.remove(menu);
  // }

  async reorderMenus(dto: ReorderMenusDto): Promise<void> {
    // Update all menu order indices in a transaction
    const updates = dto.items.map((item) => {
      return this.globalMenuRepository.update(
        { id: item.menuId },
        {
          order_index: item.newOrderIndex,
          parent_id: item.parentId !== undefined ? item.parentId : undefined,
        },
      );
    });

    await Promise.all(updates);
  }

  // ============================================
  // Organization Menu Management
  // ============================================

  async getMenusForOrganization(
    organizationId: string,
    subscriptionTier: SubscriptionTier,
  ): Promise<GlobalMenu[]> {
    // Define tier hierarchy
    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.BASIC]: 1,
      [SubscriptionTier.PROFESSIONAL]: 2,
      [SubscriptionTier.ENTERPRISE]: 3,
    };

    const userTierLevel = tierOrder[subscriptionTier];

    // Get all tiers user has access to
    const allowedTiers = Object.entries(tierOrder)
      .filter(([_, level]) => level <= userTierLevel)
      .map(([tier]) => tier as SubscriptionTier);

    // Get active global menus for user's tier
    const globalMenus = await this.globalMenuRepository.find({
      where: {
        is_active: true,
        required_tier: In(allowedTiers),
      },
      relations: ['children'],
      order: { order_index: 'ASC' },
    });

    // Get organization's menu customizations
    const orgMenus = await this.organizationMenuRepository.find({
      where: { organization_id: organizationId },
    });

    const orgMenuMap = new Map(orgMenus.map((om) => [om.global_menu_id, om]));

    // Filter and customize menus
    const filteredMenus = globalMenus
      .map((menu) => {
        const orgMenu = orgMenuMap.get(menu.id);

        // Skip if org disabled this menu
        if (orgMenu && !orgMenu.is_enabled) {
          return null;
        }

        // Apply customizations
        if (orgMenu) {
          return {
            ...menu,
            label: orgMenu.custom_label || menu.label,
            order_index: orgMenu.order_index ?? menu.order_index,
          };
        }

        return menu;
      })
      .filter(Boolean);

    return this.buildMenuTree(filteredMenus);
  }

  async initializeOrgMenus(organizationId: string): Promise<void> {
    // Get all active global menus
    const globalMenus = await this.globalMenuRepository.find({
      where: { is_active: true },
    });

    // Create organization menu entries for each global menu
    const orgMenus = globalMenus.map((menu) => {
      return this.organizationMenuRepository.create({
        organization_id: organizationId,
        global_menu_id: menu.id,
        is_enabled: true,
      });
    });

    await this.organizationMenuRepository.save(orgMenus);
  }

  async updateOrgMenu(
    organizationId: string,
    globalMenuId: string,
    dto: UpdateOrgMenuDto,
  ): Promise<void> {
    // Verify global menu exists
    await this.findGlobalMenuById(globalMenuId);

    // Find or create org menu
    let orgMenu = await this.organizationMenuRepository.findOne({
      where: {
        organization_id: organizationId,
        global_menu_id: globalMenuId,
      },
    });

    if (!orgMenu) {
      orgMenu = this.organizationMenuRepository.create({
        organization_id: organizationId,
        global_menu_id: globalMenuId,
      });
    }

    Object.assign(orgMenu, dto);
    await this.organizationMenuRepository.save(orgMenu);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private buildMenuTree(menus: GlobalMenu[]): GlobalMenu[] {
    const menuMap = new Map<string, GlobalMenu>();
    const rootMenus: GlobalMenu[] = [];

    // Create map
    menus.forEach((menu) => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // Build tree
    menus.forEach((menu) => {
      const node = menuMap.get(menu.id);
      if (menu.parent_id && menuMap.has(menu.parent_id)) {
        const parent = menuMap.get(menu.parent_id);
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        rootMenus.push(node);
      }
    });

    return rootMenus;
  }
}
