import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('assigns, reassigns, and retracts clue payoffs with stats following along', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const clueId = viewModel.snapshot.story?.clues[0]?.id ?? '';
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);
    expect(viewModel.snapshot.stats.completion).toBe(80);

    viewModel.assignPayoff(clueId, 'scene-storm');
    expect(viewModel.snapshot.story?.clues[0]?.payoffSceneId).toBe('scene-storm');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(0);
    expect(viewModel.snapshot.stats.completion).toBe(100);

    viewModel.assignPayoff(clueId, 'scene-old-harbor');
    expect(viewModel.snapshot.story?.clues[0]?.payoffSceneId).toBe('scene-old-harbor');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(0);

    viewModel.retractPayoff(clueId);
    expect(viewModel.snapshot.story?.clues[0]?.payoffSceneId).toBe('');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);
    expect(viewModel.snapshot.stats.completion).toBe(80);
  });

  it('rejects unknown payoff scenes and keeps the clue pending', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const clueId = viewModel.snapshot.story?.clues[0]?.id ?? '';
    viewModel.assignPayoff(clueId, 'scene-not-exist');
    expect(viewModel.snapshot.story?.clues[0]?.payoffSceneId).toBe('');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);
    expect(viewModel.snapshot.notice).toContain('有效的回收场景');
  });

  it('allows payoff edits after completion and recomputes completion', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const clueId = viewModel.snapshot.story?.clues[0]?.id ?? '';
    viewModel.completeProject();
    expect(viewModel.snapshot.status).toBe('completed');

    viewModel.assignPayoff(clueId, 'scene-storm');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(0);
    expect(viewModel.snapshot.stats.completion).toBe(100);

    viewModel.retractPayoff(clueId);
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);
    expect(viewModel.snapshot.stats.completion).toBe(80);
  });
});
