import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { NOTIFICATION_DEFAULT_PREFERENCES } from 'src/utils/constants/notifications';
import { Repository } from 'typeorm';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(UserNotificationPreference)
    private prefRepo: Repository<UserNotificationPreference>,
  ) {}

  async getUserPreferences(userId: number) {
    return this.prefRepo.find({ where: { user: { id: userId } } });
  }

  async updatePreference(
    userId: number,
    type: string,
    prefs: Partial<{ in_app: boolean; email: boolean; push: boolean }>,
  ) {
    let preference = await this.prefRepo.findOne({
      where: { user: { id: userId }, notification_type: type },
    });

    if (!preference) {
      preference = this.prefRepo.create({
        user: { id: userId },
        notification_type: type,
        ...NOTIFICATION_DEFAULT_PREFERENCES[type], // fallback
        ...prefs,
      });
    } else {
      Object.assign(preference, prefs);
    }

    return this.prefRepo.save(preference);
  }
}
