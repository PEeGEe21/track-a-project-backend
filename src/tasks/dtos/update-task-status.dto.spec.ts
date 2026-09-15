import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTaskStatusDto } from './update-task-status.dto';

describe('UpdateTaskStatusDto', () => {
  it('coerces numeric string ids from drag-and-drop clients', async () => {
    const dto = plainToInstance(UpdateTaskStatusDto, {
      statusId: '18',
      sourceTaskIds: ['11', '14'],
      targetTaskIds: ['5', '83'],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      statusId: 18,
      sourceTaskIds: [11, 14],
      targetTaskIds: [5, 83],
    });
  });
});
