import { NoteTranscriptionService } from './note-transcription.service';

describe('NoteTranscriptionService governance', () => {
  it('audits provider metadata and transcript size without storing content', async () => {
    const noteRepository: any = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        organization_id: 'org-1',
        audio_path: 'notes/audio.webm',
        audio_mime_type: 'audio/webm',
      }),
      update: jest.fn(),
    };
    const provider: any = {
      name: 'test-provider',
      model: 'test-transcriber',
      isConfigured: () => true,
      transcribeAudio: jest.fn().mockResolvedValue({ transcript: 'hello world' }),
    };
    const governance: any = {
      assertAvailable: jest.fn(),
      start: jest.fn().mockResolvedValue({ correlation_id: 'c1' }),
      finish: jest.fn(),
    };
    const service = new NoteTranscriptionService(
      { getBullConnection: jest.fn() } as any,
      noteRepository,
      { downloadFile: jest.fn().mockResolvedValue(Buffer.from('audio')) } as any,
      provider,
      governance,
    );
    const actor = { userId: 9, email: 'user@example.com', role: 'member' } as any;

    await service.processNoteTranscription(1, 'org-1', actor);

    expect(governance.assertAvailable).toHaveBeenCalledWith(actor, 'org-1');
    expect(governance.start).toHaveBeenCalledWith(
      expect.objectContaining({
        featureId: 'note_audio_transcription',
        provider: 'test-provider',
        model: 'test-transcriber',
        inputSize: 5,
      }),
    );
    expect(governance.finish).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Number),
      expect.objectContaining({ status: 'succeeded', outputSize: 11 }),
    );
  });
});
