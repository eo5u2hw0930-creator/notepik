import { Header } from './components/Header/Header';
import { Transport } from './components/Transport/Transport';
import { TrackList } from './components/TrackList/TrackList';
import { PianoRoll } from './components/PianoRoll/PianoRoll';
import { Mixer } from './components/Mixer/Mixer';
import './App.css';

function App() {
  return (
    <div className="daw-app">
      <Header />
      <Transport />
      <div className="daw-main">
        <TrackList />
        <PianoRoll />
      </div>
      <Mixer />
    </div>
  );
}

export default App;
