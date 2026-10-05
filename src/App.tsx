import { useState } from 'react';
import type { AppSection } from './domain/workspace';
import { navigationItems, wizardSteps } from './data/navigation';
import { AppNavigation } from './components/AppNavigation';
import { AssetExplorer } from './components/AssetExplorer';
import { GuidePage } from './components/GuidePage';
import { StepRail } from './components/StepRail';
import { WelcomePage } from './components/WelcomePage';
import { WorkspaceConsole } from './components/WorkspaceConsole';
import { ProviderManager } from './components/ProviderManager';
import './styles.css';

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('welcome');
  const [activeStep, setActiveStep] = useState('repositories');
  const [assetDeepLink, setAssetDeepLink] = useState<{ path: string; token: number } | null>(null);

  const openAsset = (path: string) => {
    setAssetDeepLink({ path, token: Date.now() });
    setActiveSection('assets');
  };

  return (
    <div className="app-shell">
      <AppNavigation items={navigationItems} activeSection={activeSection} onSelect={setActiveSection} />
      {activeSection === 'welcome' ? <WelcomePage onNavigate={setActiveSection} onOpenAsset={openAsset} /> : null}
      {activeSection === 'guide' ? <GuidePage onNavigate={setActiveSection} /> : null}
      {activeSection === 'assets' ? <AssetExplorer deepLink={assetDeepLink} /> : null}
      {activeSection === 'console' ? (
        <div className="console-shell">
          <StepRail steps={wizardSteps} activeStep={activeStep} onSelect={setActiveStep} compact />
          <WorkspaceConsole activeStep={activeStep} />
        </div>
      ) : null}
      {activeSection === 'providers' ? <ProviderManager /> : null}
    </div>
  );
}
