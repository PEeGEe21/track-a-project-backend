import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadNoteAudioDto } from './upload-note-audio.dto';

describe('UploadNoteAudioDto', () => {
  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('parses multipart consent %p as %p', async (input, expected) => {
    const dto = plainToInstance(UploadNoteAudioDto, {
      recordingConsent: input,
      noticeVersion: 'audio-note-v1',
    });
    expect(dto.recordingConsent).toBe(expected);
    expect(await validate(dto)).toHaveLength(0);
  });
});
