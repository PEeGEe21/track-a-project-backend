import { buildDefaultAvatarUrl } from './default-avatar';

describe('buildDefaultAvatarUrl', () => {
  it('returns the same DiceBear avatar for equivalent email identities', () => {
    expect(buildDefaultAvatarUrl(' Person@Example.com ')).toBe(
      buildDefaultAvatarUrl('person@example.com'),
    );
  });

  it('does not expose the email address in the avatar URL', () => {
    const url = buildDefaultAvatarUrl('private@example.com');

    expect(url).toContain('https://api.dicebear.com/10.x/shapes/svg?seed=');
    expect(url).not.toContain('private');
    expect(url).not.toContain('example.com');
  });
});
