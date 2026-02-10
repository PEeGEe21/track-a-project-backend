import { SelectQueryBuilder, Brackets } from 'typeorm';

export class TenantQueryHelper {
  /**
   * Add organization filter to any query builder
   * @param qb - TypeORM QueryBuilder
   * @param organizationId - Current organization ID
   * @param alias - Table alias (default: main entity alias)
   */
  static addOrganizationFilter<T>(
    qb: SelectQueryBuilder<T>,
    organizationId: string,
    alias?: string,
  ): SelectQueryBuilder<T> {
    const tableAlias = alias || qb.alias;
    
    qb.andWhere(`${tableAlias}.organization_id = :organizationId`, {
      organizationId,
    });

    return qb;
  }

  /**
   * Add user access filter (for projects, whiteboards, etc.)
   * Includes: owned by user OR user is a peer
   * @param qb - TypeORM QueryBuilder
   * @param userId - Current user ID
   * @param organizationId - Current organization ID
   * @param options - Configuration options
   */
  static addUserAccessFilter<T>(
    qb: SelectQueryBuilder<T>,
    userId: number,
    organizationId: string,
    options: {
      entityAlias?: string;
      userIdColumn?: string;
      peerTable?: string;
      peerProjectColumn?: string;
      includeOrganizationFilter?: boolean;
    } = {},
  ): SelectQueryBuilder<T> {
    const {
      entityAlias = qb.alias,
      userIdColumn = 'user_id',
      peerTable = 'project_peers',
      peerProjectColumn = 'project_id',
      includeOrganizationFilter = true,
    } = options;

    // First, always filter by organization
    if (includeOrganizationFilter) {
      this.addOrganizationFilter(qb, organizationId, entityAlias);
    }

    // Then add user access (owned OR peer)
    qb.andWhere(
      new Brackets((qb) => {
        // User owns the entity
        qb.where(`${entityAlias}.${userIdColumn} = :userId`, { userId });

        // OR user is a peer on the project
        if (peerTable) {
          qb.orWhere((subQb) => {
            const subQuery = subQb
              .subQuery()
              .select(`pp.${peerProjectColumn}`)
              .from(peerTable, 'pp')
              .where('pp.user_id = :userId', { userId })
              .andWhere('pp.organization_id = :organizationId', {
                organizationId,
              })
              .getQuery();
            return `${entityAlias}.id IN ${subQuery}`;
          });
        }
      }),
    );

    return qb;
  }

  /**
   * Create a base query with organization filter already applied
   * @param repository - TypeORM Repository
   * @param organizationId - Current organization ID
   * @param alias - Optional table alias
   */
  static createOrganizationQuery<T>(
    repository: any,
    organizationId: string,
    alias?: string,
  ): SelectQueryBuilder<T> {
    const qb = repository.createQueryBuilder(alias);
    return this.addOrganizationFilter(qb, organizationId, alias);
  }
}