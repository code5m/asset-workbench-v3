import { useEffect, useState } from 'react';
import type { AppSection, FrameworkFocus } from './domain/workspace';
import { navigationItems, wizardSteps } from './data/navigation';
import { AppNavigation } from './components/AppNavigation';
import { AssetExplorer } from './components/AssetExplorer';
import { GuidePage } from './components/GuidePage';
import { StepRail } from './components/StepRail';
import { WelcomePage } from './components/WelcomePage';
import { WorkspaceConsole } from './components/WorkspaceConsole';
import { ProviderManager } from './components/ProviderManager';
import { FrameworkPage } from './components/FrameworkPage';
import { assetClient } from './services/assetClient';
import './styles.css';

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('welcome');
  const [activeStep, setActiveStep] = useState('repositories');
  const [consoleView, setConsoleView] = useState<'project' | 'creator'>('project');
  const [isManagedInstance, setIsManagedInstance] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    assetClient.config().then((cfg) => {
      if (alive) setIsManagedInstance(cfg.lockedToInstance === true);
    }).catch(() => { if (alive) setIsManagedInstance(true); });
    return () => { alive = false; };
  }, []);
  const [assetDeepLink, setAssetDeepLink] = useState<{ path: string; token: number } | null>(null);
  const [frameworkFocus, setFrameworkFocus] = useState<{ focus: FrameworkFocus; token: number } | null>(null);

  const openAsset = (path: string) => {
    setAssetDeepLink({ path, token: Date.now() });
    setActiveSection('assets');
  };

  const openFramework = (focus: FrameworkFocus = 'architecture') => {
    setFrameworkFocus({ focus, token: Date.now() });
    setActiveSection('framework');
  };

  const openCreatorWorkbench = () => {
    if (isManagedInstance) { setActiveSection('guide'); return; }
    setConsoleView('creator');
    setActiveSection('console');
  };

  if (isManagedInstance === null) return <div className="app-startup-loading" role="status">正在加载工作台…</div>;

  return (
    <div className="app-shell">
      <AppNavigation items={navigationItems} activeSection={activeSection} onSelect={setActiveSection} isManagedInstance={isManagedInstance} />
      {activeSection === 'welcome' ? <WelcomePage onNavigate={setActiveSection} onOpenAsset={openAsset} /> : null}
      {activeSection === 'guide' ? <GuidePage onNavigate={setActiveSection} onOpenAsset={openAsset} /> : null}
      {activeSection === 'assets' ? <AssetExplorer deepLink={assetDeepLink} onOpenFramework={openFramework} /> : null}
      {activeSection === 'console' ? (
        <div className="console-shell">
          <StepRail steps={wizardSteps} activeStep={activeStep} onSelect={(step) => { setActiveStep(step); setConsoleView('project'); }} compact />
          <WorkspaceConsole activeStep={activeStep} view={isManagedInstance ? 'project' : consoleView} isManagedInstance={isManagedInstance} onViewChange={(next) => { if (!isManagedInstance) setConsoleView(next); }} onActivated={() => setActiveSection('assets')} />
        </div>
      ) : null}
      {activeSection === 'providers' ? <ProviderManager onNavigate={setActiveSection} onOpenAsset={openAsset} /> : null}
      {activeSection === 'framework' ? <FrameworkPage onNavigate={setActiveSection} onOpenCreator={openCreatorWorkbench} allowCreator={!isManagedInstance} focusRequest={frameworkFocus} /> : null}
    </div>
  );
}
