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

  it('backfills, re-judges, and withdraws a clue payoff with stats rollback', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    const [firstScene, secondScene] = viewModel.allScenes;
    const clueId = viewModel.snapshot.story?.clues[0]?.id ?? '';
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);

    // 补录回收：待回收 -> 已回收
    viewModel.setCluePayoff(clueId, secondScene.id);
    let clue = viewModel.snapshot.story?.clues[0];
    expect(clue?.payoffSceneId).toBe(secondScene.id);
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(0);

    // 改判到别的一幕
    viewModel.setCluePayoff(clueId, firstScene.id);
    clue = viewModel.snapshot.story?.clues[0];
    expect(clue?.payoffSceneId).toBe(firstScene.id);
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(0);

    // 撤回：重新待回收，统计与完成度回退
    const resolvedCompletion = viewModel.snapshot.stats.completion;
    viewModel.setCluePayoff(clueId, '');
    clue = viewModel.snapshot.story?.clues[0];
    expect(clue?.payoffSceneId).toBe('');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);
    expect(viewModel.snapshot.stats.completion).toBeLessThan(resolvedCompletion);

    // 无效场景被拒绝
    viewModel.setCluePayoff(clueId, 'scene-missing');
    expect(viewModel.snapshot.story?.clues[0].payoffSceneId).toBe('');
  });

  it('allows changing a payoff after the project is completed and recomputes completion', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    const clueId = viewModel.snapshot.story?.clues[0]?.id ?? '';
    const payoffScene = viewModel.allScenes[1];
    viewModel.setCluePayoff(clueId, payoffScene.id);
    viewModel.completeProject();
    expect(viewModel.snapshot.status).toBe('completed');
    const completedStats = viewModel.snapshot.stats;

    // 收尾之后撤回回收，完成度必须重新计算
    viewModel.setCluePayoff(clueId, '');
    expect(viewModel.snapshot.stats.unresolvedClues).toBe(1);
    expect(viewModel.snapshot.stats.completion).toBeLessThan(completedStats.completion);
  });
});
