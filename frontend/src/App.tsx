import { useState } from 'react';
import { ImportScreen } from './features/import/ImportScreen';
import { WalkScreen } from './features/walk/WalkScreen';

type Screen = 'walk' | 'import';

function App() {
  const [screen, setScreen] = useState<Screen>('walk');

  return (
    <div className="min-h-screen">
      <nav className="flex bg-slate-950">
        <button
          type="button"
          className={`min-h-12 flex-1 text-base font-medium ${
            screen === 'walk' ? 'border-b-2 border-sky-400 text-white' : 'text-slate-400'
          }`}
          onClick={() => setScreen('walk')}
        >
          Walk
        </button>
        <button
          type="button"
          className={`min-h-12 flex-1 text-base font-medium ${
            screen === 'import' ? 'border-b-2 border-sky-400 text-white' : 'text-slate-400'
          }`}
          onClick={() => setScreen('import')}
        >
          Import
        </button>
      </nav>

      {screen === 'walk' ? (
        <WalkScreen />
      ) : (
        <div className="min-h-screen bg-slate-950">
          <ImportScreen />
        </div>
      )}
    </div>
  );
}

export default App;
