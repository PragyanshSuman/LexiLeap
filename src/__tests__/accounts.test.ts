import { useAppStore } from '@/store/appStore';

beforeEach(() => {
  useAppStore.setState({ profiles: [], activeProfileId: null, parent: null, progress: {} });
});

describe('local accounts', () => {
  it('registers a child with a hashed password and logs in case-insensitively', async () => {
    const { addProfile, logIn } = useAppStore.getState();
    const id = await addProfile({ name: 'StarReader', age: 7, avatar: '🦊' }, 'moon');
    const saved = useAppStore.getState().profiles[0];
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toContain('moon');

    expect(await logIn('starreader', 'nope')).toBe('wrong-password');
    expect(useAppStore.getState().activeProfileId).toBeNull();
    expect(await logIn('Nobody', 'moon')).toBe('unknown-user');
    expect(await logIn('  STARREADER ', 'moon')).toBe('ok');
    expect(useAppStore.getState().activeProfileId).toBe(id);
  });

  it('rejects a duplicate name', async () => {
    const { addProfile } = useAppStore.getState();
    await addProfile({ name: 'Ada', age: 6, avatar: '🐼' }, 'pass1');
    await expect(addProfile({ name: 'ada', age: 8, avatar: '🐯' }, 'pass2')).rejects.toThrow('already taken');
    expect(useAppStore.getState().isUsernameTaken('ADA')).toBe(true);
    const id = useAppStore.getState().profiles[0].id;
    expect(useAppStore.getState().isUsernameTaken('Ada', id)).toBe(false);
  });

  it('lets a parent set a new password', async () => {
    const { addProfile, setPassword, logIn } = useAppStore.getState();
    const id = await addProfile({ name: 'Ben', age: 5, avatar: '🐸' }, 'old1');
    await setPassword(id, 'new2');
    expect(await logIn('Ben', 'old1')).toBe('wrong-password');
    expect(await logIn('Ben', 'new2')).toBe('ok');
  });
});
