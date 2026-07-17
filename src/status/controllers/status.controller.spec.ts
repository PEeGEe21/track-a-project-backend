import { StatusController } from './status.controller';

describe('StatusController', () => {
  it('should be defined', () => {
    expect(new StatusController({} as any)).toBeDefined();
  });
});
