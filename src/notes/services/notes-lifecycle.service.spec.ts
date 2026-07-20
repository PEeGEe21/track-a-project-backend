import { HttpException } from '@nestjs/common';
import { NotesService } from './notes.service';

describe('NotesService lifecycle controls', () => {
  const user = { userId: 7 };
  const organizationId = 'org-1';

  function setup(noteOverrides: Record<string, unknown> = {}) {
    const note = {
      id: 3,
      organization_id: organizationId,
      user: { id: 7 },
      audio_path: 'org-1/notes/3/audio.webm',
      audio_url: 'private-url',
      audio_mime_type: 'audio/webm',
      audio_duration_seconds: 10,
      audio_transcript: 'sensitive transcript',
      audio_transcript_status: 'completed',
      audio_consent_at: new Date(),
      audio_consent_by_id: 7,
      audio_notice_version: 'audio-note-v1',
      ...noteOverrides,
    };
    const users: any = {
      getUserAccountById: jest.fn().mockResolvedValue({ id: 7 }),
    };
    const notes: any = {
      findOne: jest.fn().mockResolvedValue(note),
      save: jest.fn(async (value) => value),
      delete: jest.fn(),
    };
    const storage: any = {
      deleteFile: jest.fn(),
      getSignedUrl: jest.fn().mockResolvedValue('signed-url'),
      uploadFile: jest.fn().mockResolvedValue('private-url'),
    };
    const lifecycle: any = { record: jest.fn(), history: jest.fn() };
    const service = new NotesService(
      users,
      {} as any,
      notes,
      {} as any,
      {} as any,
      storage,
      {} as any,
      lifecycle,
    );
    return { service, note, notes, storage, lifecycle };
  }

  it('requires affirmative consent before audio upload', async () => {
    const { service, storage } = setup({ audio_path: null });
    await expect(
      service.uploadNoteAudio(
        3,
        { mimetype: 'audio/webm', originalname: 'audio.webm' } as any,
        user,
        organizationId,
        2,
        undefined,
        false,
        'audio-note-v1',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('hard-deletes source audio and transcript while preserving content-free audit metadata', async () => {
    const { service, note, notes, storage, lifecycle } = setup();
    await service.deleteAudio(3, user, organizationId);
    expect(storage.deleteFile).toHaveBeenCalledWith('org-1/notes/3/audio.webm');
    expect(note).toMatchObject({
      audio_path: null,
      audio_url: null,
      audio_transcript: null,
      audio_consent_at: null,
      audio_notice_version: null,
    });
    expect(notes.save).toHaveBeenCalled();
    expect(lifecycle.record).toHaveBeenCalledWith(
      expect.not.objectContaining({
        metadata: expect.objectContaining({ transcript: expect.anything() }),
      }),
    );
  });

  it('exports through a short-lived signed URL after ownership verification', async () => {
    const { service, storage, lifecycle } = setup();
    const result = await service.exportAudio(3, user, organizationId);
    expect(storage.getSignedUrl).toHaveBeenCalledWith(
      'org-1/notes/3/audio.webm',
      300,
    );
    expect(result.data.download_url).toBe('signed-url');
    expect(lifecycle.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'exported' }),
    );
  });
});
