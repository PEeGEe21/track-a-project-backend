import { ReliableIntegrationDelivery1789300000000 } from 'src/migrations/1789300000000-ReliableIntegrationDelivery';

describe('ReliableIntegrationDelivery migration', () => {
  it('creates the durable endpoint, checkpoint, delivery, and attempt schema', async () => {
    const queries: string[] = [];
    const runner = { query: jest.fn(async (sql: string) => queries.push(sql)) };
    await new ReliableIntegrationDelivery1789300000000().up(runner as any);
    const sql = queries.join('\n');
    expect(sql).toContain('integration_endpoints');
    expect(sql).toContain('integration_publisher_checkpoints');
    expect(sql).toContain('integration_deliveries');
    expect(sql).toContain('integration_delivery_attempts');
    expect(sql).toContain('UQ_integration_delivery_generation');
    expect(sql).toContain('UQ_integration_attempt_number');
    expect(sql).not.toContain('FK_integration_delivery_event');
  });

  it('drops child tables before their parents', async () => {
    const queries: string[] = [];
    const runner = { query: jest.fn(async (sql: string) => queries.push(sql)) };
    await new ReliableIntegrationDelivery1789300000000().down(runner as any);
    expect(queries).toEqual([
      'DROP TABLE `integration_delivery_attempts`',
      'DROP TABLE `integration_deliveries`',
      'DROP TABLE `integration_publisher_checkpoints`',
      'DROP TABLE `integration_endpoints`',
    ]);
  });
});
