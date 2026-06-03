import { DataSource } from 'typeorm';
import { Plan } from '../../typeorm/entities/Plan';
import { Price } from '../../typeorm/entities/Price';
import { PriceInterval } from '../../utils/constants/priceIntervalEnums';

type CatalogPlan = {
  code: string;
  name: string;
  description: string;
  displayOrder: number;
  prices: Array<{
    interval: PriceInterval;
    unitAmount: number;
    currency?: string;
  }>;
};

const catalog: CatalogPlan[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'A lightweight plan for early teams and trial workspaces.',
    displayOrder: 1,
    prices: [
      {
        interval: PriceInterval.ONE_TIME,
        unitAmount: 0,
      },
    ],
  },
  {
    code: 'basic',
    name: 'Basic',
    description: 'A balanced plan for growing teams that need more capacity.',
    displayOrder: 2,
    prices: [
      {
        interval: PriceInterval.MONTH,
        unitAmount: 29,
      },
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    description:
      'A higher-capacity plan for active cross-functional organizations.',
    displayOrder: 3,
    prices: [
      {
        interval: PriceInterval.MONTH,
        unitAmount: 99,
      },
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description:
      'Large-scale workspace capacity with effectively unlimited room.',
    displayOrder: 4,
    prices: [
      {
        interval: PriceInterval.MONTH,
        unitAmount: 299,
      },
    ],
  },
];

export const seedBillingCatalog = async (dataSource: DataSource) => {
  const planRepo = dataSource.getRepository(Plan);
  const priceRepo = dataSource.getRepository(Price);

  for (const item of catalog) {
    let plan = await planRepo.findOne({
      where: { code: item.code },
      relations: ['prices'],
    });

    if (!plan) {
      plan = planRepo.create({
        code: item.code,
        name: item.name,
        description: item.description,
        is_public: true,
        is_active: true,
        display_order: item.displayOrder,
      });
      plan = await planRepo.save(plan);
      console.log(`Plan created: ${item.code}`);
    } else {
      let changed = false;

      if (plan.name !== item.name) {
        plan.name = item.name;
        changed = true;
      }
      if (plan.description !== item.description) {
        plan.description = item.description;
        changed = true;
      }
      if (plan.display_order !== item.displayOrder) {
        plan.display_order = item.displayOrder;
        changed = true;
      }
      if (!plan.is_public) {
        plan.is_public = true;
        changed = true;
      }
      if (!plan.is_active) {
        plan.is_active = true;
        changed = true;
      }

      if (changed) {
        plan = await planRepo.save(plan);
        console.log(`Plan updated: ${item.code}`);
      }
    }

    for (const priceDef of item.prices) {
      const existingPrice = await priceRepo.findOne({
        where: {
          plan: { id: plan.id },
          interval: priceDef.interval,
        },
      });

      if (!existingPrice) {
        const price = priceRepo.create({
          plan_id: plan.id,
          interval: priceDef.interval,
          unit_amount: priceDef.unitAmount,
          currency: priceDef.currency ?? 'USD',
          is_active: true,
        });
        await priceRepo.save(price);
        console.log(
          `Price created: ${item.code} (${priceDef.interval} ${priceDef.unitAmount})`,
        );
        continue;
      }

      let priceChanged = false;

      if (Number(existingPrice.unit_amount) !== priceDef.unitAmount) {
        existingPrice.unit_amount = priceDef.unitAmount;
        priceChanged = true;
      }
      if ((existingPrice.currency || 'USD') !== (priceDef.currency ?? 'USD')) {
        existingPrice.currency = priceDef.currency ?? 'USD';
        priceChanged = true;
      }
      if (!existingPrice.is_active) {
        existingPrice.is_active = true;
        priceChanged = true;
      }

      if (priceChanged) {
        await priceRepo.save(existingPrice);
        console.log(
          `Price updated: ${item.code} (${priceDef.interval} ${priceDef.unitAmount})`,
        );
      }
    }
  }

  console.log('Billing catalog seeded successfully');
};
