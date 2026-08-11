import { useState } from 'react';
import { ImportScreen } from './features/import/ImportScreen';
import { WalkScreen } from './features/walk/WalkScreen';
import { ReviewScreen } from './features/review/ReviewScreen';

type Screen = 'walk' | 'review' | 'import';

function App() {
  const [screen, setScreen] = useState<Screen>('walk');
  const [autoJumpToUnchecked, setAutoJumpToUnchecked] = useState(false);

  function goToWalkAndJump() {
    setAutoJumpToUnchecked(true);
    setScreen('walk');
  }

  function selectTab(next: Screen) {
    setAutoJumpToUnchecked(false);
    setScreen(next);
  }

  return (
    <div className="min-h-screen">
      <nav className="flex bg-slate-950 print:hidden">
        <button
          type="button"
          className={`min-h-12 flex-1 text-base font-medium ${
            screen === 'walk' ? 'border-b-2 border-sky-400 text-white' : 'text-slate-400'
          }`}
          onClick={() => selectTab('walk')}
        >
          Walk
        </button>
        <button
          type="button"
          className={`min-h-12 flex-1 text-base font-medium ${
            screen === 'review' ? 'border-b-2 border-sky-400 text-white' : 'text-slate-400'
          }`}
          onClick={() => selectTab('review')}
        >
          Review
        </button>
        <button
          type="button"
          className={`min-h-12 flex-1 text-base font-medium ${
            screen === 'import' ? 'border-b-2 border-sky-400 text-white' : 'text-slate-400'
          }`}
          onClick={() => selectTab('import')}
        >
          Import
        </button>
      </nav>

      {screen === 'walk' && <WalkScreen autoJumpToUnchecked={autoJumpToUnchecked} />}
      {screen === 'review' && <ReviewScreen onGoToWalk={goToWalkAndJump} />}
      {screen === 'import' && (
        <div className="min-h-screen bg-slate-950">
          <ImportScreen />
        </div>
      )}
    </div>
  );
}

export default App;
