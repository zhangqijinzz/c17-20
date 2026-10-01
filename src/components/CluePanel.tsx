import { useState } from 'react';
import type { StoryScene } from '../models/story';
import { isClueResolved } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface CluePanelProps { viewModel: StoryViewModel; scenes: StoryScene[]; }

export function CluePanel({ viewModel, scenes }: CluePanelProps) {
  const [title, setTitle] = useState('');
  const [setup, setSetup] = useState(scenes[0]?.id ?? '');
  const [payoff, setPayoff] = useState('');
  const story = viewModel.snapshot.story;
  const sceneTitle = (sceneId: string) => scenes.find((scene) => scene.id === sceneId)?.title ?? '未知场景';
  const submit = () => { viewModel.addClue(title, setup, payoff); setTitle(''); setPayoff(''); };
  return (
    <section className="panel clue-panel">
      <div className="panel-heading"><div><span className="eyebrow">THREADS / 叙事线索</span><h2>伏笔关系</h2></div><span className="unresolved"><i /> {viewModel.snapshot.stats.unresolvedClues} 个待回收</span></div>
      <div className="clue-list">{story?.clues.map((clue) => {
        const resolved = isClueResolved(story, clue);
        return (
          <div className="clue-row" key={clue.id}>
            <span className="clue-symbol">⌁</span>
            <div>
              <strong>{clue.title}</strong>
              <span>{sceneTitle(clue.setupSceneId)} <b>→</b> {resolved ? sceneTitle(clue.payoffSceneId) : '待回收'}</span>
              <div className="clue-payoff-edit">
                <select aria-label={`${clue.title} 的回收场景`} value={clue.payoffSceneId} onChange={(event) => viewModel.setCluePayoff(clue.id, event.target.value)}>
                  <option value="">待回收（撤回）</option>
                  {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}
                </select>
                {resolved && <button className="payoff-withdraw" onClick={() => viewModel.setCluePayoff(clue.id, '')}>撤回回收</button>}
              </div>
            </div>
            <em className={resolved ? 'resolved' : ''}>{resolved ? '已回收' : '未回收'}</em>
          </div>
        );
      })}</div>
      <div className="clue-form"><input aria-label="伏笔名称" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="伏笔名称，例如：罗盘上的刻痕" /><select aria-label="埋下场景" value={setup} onChange={(event) => setSetup(event.target.value)}><option value="">埋下场景…</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select><select aria-label="回收场景" value={payoff} onChange={(event) => setPayoff(event.target.value)}><option value="">回收场景（稍后）</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select><button onClick={submit}>建立关系</button></div>
    </section>
  );
}
