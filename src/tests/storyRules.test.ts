import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { getStats, getTimelineWarning, orderedScenes, sanitizeStory, scenePayoffs, validateName } from '../models/storyRules';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });

  it('derives scene payoffs from clue relations', () => {
    const story = createStarterStory();
    expect(scenePayoffs(story, 'scene-storm')).toHaveLength(0);
    story.clues[0].payoffSceneId = 'scene-storm';
    expect(scenePayoffs(story, 'scene-storm').map((clue) => clue.title)).toEqual(['潮汐表背后的日期']);
    story.clues[0].payoffSceneId = '';
    expect(scenePayoffs(story, 'scene-storm')).toHaveLength(0);
  });

  it('keeps legacy clues with missing payoff positions pending', () => {
    const legacy = JSON.parse(JSON.stringify(createStarterStory()));
    delete legacy.clues[0].payoffSceneId;
    const sanitized = sanitizeStory(legacy);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.clues[0]?.payoffSceneId).toBe('');
    expect(sanitized ? getStats(sanitized).unresolvedClues : 0).toBe(1);
  });
});
