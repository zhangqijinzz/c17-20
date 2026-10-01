import type { StoryCharacter, StoryClue, StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

/** 伏笔是否已回收：只有指向有效场景的回收位置才算数，空值或悬空场景一律按待回收处理。 */
export function isClueResolved(story: StoryDocument, clue: StoryClue): boolean {
  return clue.payoffSceneId !== '' && story.scenes.some((scene) => scene.id === clue.payoffSceneId);
}

/** 一个场景在伏笔两侧承担的角色：左侧埋下、右侧回收，两侧口径一致地从伏笔数据派生。 */
export function sceneClueLinks(story: StoryDocument, sceneId: string): { setupClues: StoryClue[]; payoffClues: StoryClue[] } {
  const setupClues: StoryClue[] = [];
  const payoffClues: StoryClue[] = [];
  for (const clue of story.clues) {
    if (clue.setupSceneId === sceneId) setupClues.push(clue);
    if (clue.payoffSceneId === sceneId && isClueResolved(story, clue)) payoffClues.push(clue);
  }
  return { setupClues, payoffClues };
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => !isClueResolved(story, clue)).length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  return migrateStory(candidate as GuardedStoryDocument);
}

type GuardedStoryDocument = Partial<StoryDocument> & {
  id: string;
  title: string;
  characters: Partial<StoryCharacter>[];
  scenes: Partial<StoryScene>[];
  clues: Partial<StoryClue>[];
};

/**
 * 老数据兼容：字段缺失时补默认值。
 * 回收位置（payoffSceneId）为空、不是字符串、或指向已删除场景的伏笔，加载后一律仍是待回收。
 * 场景上的伏笔标记按伏笔数据两侧统一重建，避免只在埋下一侧留下标记。
 */
function migrateStory(candidate: GuardedStoryDocument): StoryDocument {
  const characters: StoryCharacter[] = candidate.characters
    .filter((character): character is StoryCharacter => !!character && typeof character.id === 'string' && typeof character.name === 'string')
    .map((character) => ({
      id: character.id,
      name: character.name,
      role: typeof character.role === 'string' ? character.role : '',
      color: typeof character.color === 'string' ? character.color : 'coral',
    }));

  const scenes: StoryScene[] = candidate.scenes
    .filter((scene): scene is StoryScene => !!scene && typeof scene.id === 'string' && typeof scene.title === 'string')
    .map((scene) => ({
      id: scene.id,
      title: scene.title,
      order: Number.isFinite(scene.order) ? scene.order : 0,
      summary: typeof scene.summary === 'string' ? scene.summary : '',
      conflict: typeof scene.conflict === 'string' ? scene.conflict : '',
      characterIds: Array.isArray(scene.characterIds) ? scene.characterIds.filter((id) => typeof id === 'string') : [],
      clueIds: [],
    }));

  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const clues: StoryClue[] = candidate.clues
    .filter((clue): clue is StoryClue => !!clue && typeof clue.id === 'string' && typeof clue.title === 'string')
    .map((clue) => {
      const setupSceneId = typeof clue.setupSceneId === 'string' && sceneIds.has(clue.setupSceneId) ? clue.setupSceneId : '';
      const payoffSceneId = typeof clue.payoffSceneId === 'string' && sceneIds.has(clue.payoffSceneId) ? clue.payoffSceneId : '';
      return { id: clue.id, title: clue.title, setupSceneId, payoffSceneId };
    });

  // 埋下侧标记从伏笔数据重建，与回收侧使用同一份口径
  for (const clue of clues) {
    if (!clue.setupSceneId) continue;
    const scene = scenes.find((item) => item.id === clue.setupSceneId);
    if (scene) scene.clueIds.push(clue.id);
  }

  const selectedSceneId =
    typeof candidate.selectedSceneId === 'string' && sceneIds.has(candidate.selectedSceneId)
      ? candidate.selectedSceneId
      : scenes[0]?.id ?? '';

  return {
    version: 1,
    id: candidate.id,
    title: candidate.title,
    status: candidate.status === 'complete' ? 'complete' : 'draft',
    characters,
    scenes,
    clues,
    selectedSceneId,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  };
}
