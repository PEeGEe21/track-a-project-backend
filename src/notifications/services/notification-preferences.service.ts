import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import {
  NOTIFICATION_DEFAULT_PREFERENCES,
  NOTIFICATION_PREFERENCE_DETAILS,
} from 'src/utils/constants/notifications';
import { IsNull, Repository } from 'typeorm';

@Injectable()
export class NotificationPreferencesService {
  private readonly fallbackPreference = {
    in_app: true,
    email: false,
    push: false,
    sound: true,
  };

  constructor(
    @InjectRepository(UserNotificationPreference)
    private prefRepo: Repository<UserNotificationPreference>,
  ) {}

  async getUserPreferences(userId: number, organizationId?: string | null) {
    const query = this.prefRepo
      .createQueryBuilder('preference')
      .where('preference.user_id = :userId', { userId });

    if (organizationId) {
      query.andWhere(
        '(preference.organization_id = :organizationId OR preference.organization_id IS NULL)',
        { organizationId },
      );
    } else {
      query.andWhere('preference.organization_id IS NULL');
    }

    return query.getMany();
  }

  async getEffectivePreferences(
    userId: number,
    organizationId?: string | null,
  ) {
    const storedPreferences = await this.getUserPreferences(
      userId,
      organizationId,
    );
    const keyedPreferences = new Map<string, UserNotificationPreference>();

    for (const preference of storedPreferences) {
      const shouldReplace =
        !keyedPreferences.has(preference.notification_type) ||
        preference.organization_id === organizationId;

      if (shouldReplace) {
        keyedPreferences.set(preference.notification_type, preference);
      }
    }

    return Object.entries(NOTIFICATION_DEFAULT_PREFERENCES).map(
      ([type, defaults]) => {
        const storedPreference = keyedPreferences.get(type);
        const details = NOTIFICATION_PREFERENCE_DETAILS[type];

        return {
          type,
          label: details?.label ?? type,
          description: details?.description ?? '',
          in_app: storedPreference?.in_app ?? defaults.in_app,
          email: storedPreference?.email ?? defaults.email,
          push: storedPreference?.push ?? defaults.push,
          sound: storedPreference?.sound ?? defaults.sound,
        };
      },
    );
  }

  async getEffectivePreferenceForType(
    userId: number,
    type: string,
    organizationId?: string | null,
  ) {
    const storedPreferences = await this.getUserPreferences(
      userId,
      organizationId,
    );
    const matchingPreferences = storedPreferences.filter(
      (preference) => preference.notification_type === type,
    );

    const organizationPreference = matchingPreferences.find(
      (preference) => preference.organization_id === organizationId,
    );
    const globalPreference = matchingPreferences.find(
      (preference) => preference.organization_id == null,
    );

    const effectivePreference =
      organizationPreference ?? globalPreference ?? null;
    const defaults =
      NOTIFICATION_DEFAULT_PREFERENCES[type] ?? this.fallbackPreference;
    const details = NOTIFICATION_PREFERENCE_DETAILS[type];

    return {
      type,
      label: details?.label ?? type,
      description: details?.description ?? '',
      in_app: effectivePreference?.in_app ?? defaults.in_app,
      email: effectivePreference?.email ?? defaults.email,
      push: effectivePreference?.push ?? defaults.push,
      sound: effectivePreference?.sound ?? defaults.sound,
    };
  }

  async updatePreference(
    userId: number,
    type: string,
    prefs: Partial<{
      in_app: boolean;
      email: boolean;
      push: boolean;
      sound: boolean;
    }>,
    organizationId?: string | null,
  ) {
    let preference = await this.prefRepo.findOne({
      where: {
        user: { id: userId },
        notification_type: type,
        organization_id: organizationId ?? IsNull(),
      },
    });

    if (!preference) {
      preference = this.prefRepo.create({
        user: { id: userId },
        notification_type: type,
        organization_id: organizationId ?? null,
        ...(NOTIFICATION_DEFAULT_PREFERENCES[type] ?? this.fallbackPreference),
        ...prefs,
      });
    } else {
      Object.assign(preference, prefs);
    }

    return this.prefRepo.save(preference);
  }

  async updatePreferences(
    userId: number,
    preferences: Array<
      Partial<{
        in_app: boolean;
        email: boolean;
        push: boolean;
        sound: boolean;
      }> & {
        type: string;
      }
    >,
    organizationId?: string | null,
  ) {
    await Promise.all(
      preferences.map(({ type, ...channels }) =>
        this.updatePreference(userId, type, channels, organizationId),
      ),
    );

    return this.getEffectivePreferences(userId, organizationId);
  }
}
