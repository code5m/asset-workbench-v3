import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Info } from 'lucide-react';
import type { AssetNode } from '../domain/asset';
import { assetClient } from '../services/assetClient';
import {
  BEGINNER_ROLE_NAMES,
  type BeginnerDirectoryGuide,
} from '../data/beginnerDirectoryGuide';
import { useI18n } from '../i18n/I18nProvider';

/** An explanation about a directory that the real scanner has already returned. */
export function DirectoryLearningPanel({
  node,
  guide,
  rootPaths,
  onOpenPath,
}: {
  node: AssetNode;
  guide: BeginnerDirectoryGuide;
  rootPaths: string[];
  onOpenPath: (path: string) => void;
}) {
  const { loc, lang } = useI18n();
  const zh = lang === 'zh-CN';
  const [exampleStatus, setExampleStatus] = useState<'loading' | 'found' | 'missing'>('loading');

  useEffect(() => {
    let alive = true;
    const candidate = guide.startAt;
    if (!candidate) {
      setExampleStatus('missing');
      return () => { alive = false; };
    }
    const parentPath = candidate.split('/').slice(0, -1).join('/');
    // Only propose a real direct child of the directory, not an unverified static path.
    if (parentPath !== node.relativePath) {
      setExampleStatus('missing');
      return () => { alive = false; };
    }
    setExampleStatus('loading');
    assetClient.tree(node.relativePath)
      .then((tree) => {
        if (alive) setExampleStatus(tree.children.some((child) => child.relativePath === candidate) ? 'found' : 'missing');
      })
      .catch(() => { if (alive) setExampleStatus('missing'); });
    return () => { alive = false; };
  }, [node.relativePath, guide.startAt]);

  const contrastExists = !!guide.contrast && rootPaths.includes(guide.contrast.path);

  return (
    <section className="beginner-directory-detail" aria-label={zh ? '这个目录是做什么的' : 'About this directory'}>
      <header className="beginner-directory-detail-head">
        <BookOpen size={19} aria-hidden="true" />
        <div>
          <strong>{loc(guide.summary)}</strong>
          <small>{loc(BEGINNER_ROLE_NAMES[guide.role])} · {zh ? '真实目录说明' : 'Real directory guide'}</small>
        </div>
      </header>
      <div className="beginner-directory-facts">
        <div>
          <h3>{zh ? '这是什么？' : 'What is it?'}</h3>
          <p>{loc(guide.what)}</p>
        </div>
        <div>
          <h3>{zh ? '为什么需要它？' : 'Why does it exist?'}</h3>
          <p>{loc(guide.why)}</p>
        </div>
        <div>
          <h3>{zh ? '我应该怎么开始？' : 'Where should I start?'}</h3>
          <p>{loc(guide.learn)}</p>
        </div>
      </div>
      {guide.startAt ? (
        <div className="beginner-directory-start">
          {exampleStatus === 'found' ? (
            <button type="button" className="beginner-inline-link" onClick={() => onOpenPath(guide.startAt!)}>
              <BookOpen size={15} aria-hidden="true" />
              {zh ? '打开真实入门文件' : 'Open a real starting point'}
              <code>{guide.startAt}</code>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          ) : exampleStatus === 'loading' ? (
            <small>{zh ? '正在确认学习文件是否存在…' : 'Checking whether the learning file exists…'}</small>
          ) : (
            <small>{zh ? '当前目录没有找到建议的入门文件，请从左侧展开实际内容。' : 'Suggested starting file not found. Explore real entries on the left.'}</small>
          )}
        </div>
      ) : null}
      {guide.contrast ? (
        <div className="beginner-directory-contrast">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>{zh ? '别和另一个目录混淆' : 'Not the same as another folder'}</strong>
            <p>{loc(guide.contrast.explanation)}</p>
            {contrastExists ? (
              <button type="button" className="beginner-inline-link" onClick={() => onOpenPath(guide.contrast!.path)}>
                {zh ? '查看真实目录' : 'Open the real folder'} <code>{guide.contrast.path}</code><ArrowRight size={14} aria-hidden="true" />
              </button>
            ) : <small>{zh ? '对比目录在当前项目中不存在。' : 'Comparison directory does not exist in this project.'}</small>}
          </div>
        </div>
      ) : null}
      {guide.term ? (
        <details className="beginner-directory-terms">
          <summary>{zh ? '进一步了解：程序员怎么称呼它？' : 'Learn the technical term'}</summary>
          <p>{loc(guide.term)}</p>
        </details>
      ) : null}
    </section>
  );
}
