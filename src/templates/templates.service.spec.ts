import { BadRequestException } from '@nestjs/common';
import { ReusableTemplateType } from 'src/typeorm/entities/ReusableTemplate';
import { TemplatesService } from './templates.service';
describe('TemplatesService contract', () => {
  const service = new TemplatesService({} as any, {} as any);
  it('requires task titles and checklist items', () => {
    expect(() =>
      (service as any).validate(ReusableTemplateType.TASK, {}),
    ).toThrow(BadRequestException);
    expect(() =>
      (service as any).validate(ReusableTemplateType.CHECKLIST, { items: [] }),
    ).toThrow(BadRequestException);
  });
  it('extracts stable unique status keys', () => {
    expect(
      (service as any).statusKeys(ReusableTemplateType.CHECKLIST, {
        items: [
          { statusKey: 'Todo' },
          { statusKey: 'Todo' },
          { statusKey: 'Done' },
        ],
      }),
    ).toEqual(['Todo', 'Done']);
  });
  it('requires project tasks in project snapshots', () => {
    expect(() =>
      (service as any).validate(ReusableTemplateType.PROJECT, {
        title: 'Launch',
      }),
    ).toThrow('Project template requires title and tasks');
  });
});
