import { useDAWStore } from '../store/useDAWStore';
import { synthEngine } from './SynthEngine';

class PlaybackEngine {
  private animFrameId: number | null = null;
  private startTime: number = 0;
  private startTick: number = 0;
  private cleanupFns: (() => void)[] = [];

  async start(): Promise<void> {
    await synthEngine.init();

    const state = useDAWStore.getState();
    const { project, playback } = state;

    this.startTick = playback.currentTick;
    this.startTime = performance.now();

    // Schedule notes for all unmuted tracks
    const hasSolo = project.tracks.some((t) => t.solo);

    for (const track of project.tracks) {
      const shouldPlay = hasSolo ? track.solo : !track.mute;
      if (!shouldPlay || track.notes.length === 0) continue;

      const cleanup = synthEngine.scheduleNotes(
        track.id,
        track.instrument,
        track.notes,
        project.bpm,
        project.ticksPerBeat,
        this.startTick,
        track.volume,
        track.pan,
      );
      this.cleanupFns.push(cleanup);
    }

    useDAWStore.getState().setPlaying(true);
    this.tick();
  }

  private tick = (): void => {
    const state = useDAWStore.getState();
    if (!state.playback.isPlaying) return;

    const { project, playback } = state;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const ticksPerSecond = (project.bpm * project.ticksPerBeat) / 60;
    const currentTick = this.startTick + elapsed * ticksPerSecond;

    // Check loop
    if (
      playback.isLooping &&
      playback.loopEnd !== null &&
      currentTick >= playback.loopEnd
    ) {
      this.stop();
      useDAWStore.getState().setCurrentTick(playback.loopStart ?? 0);
      this.start();
      return;
    }

    // Check if past all notes
    const maxTick = Math.max(
      ...project.tracks.flatMap((t) =>
        t.notes.map((n) => n.startTick + n.duration)
      ),
      0,
    );
    if (currentTick > maxTick + project.ticksPerBeat * 2) {
      this.stop();
      useDAWStore.getState().stopAndReset();
      return;
    }

    useDAWStore.getState().setCurrentTick(currentTick);
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    synthEngine.stopAll();
    useDAWStore.getState().setPlaying(false);
  }

  toggle(): void {
    const { playback } = useDAWStore.getState();
    if (playback.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }
}

export const playbackEngine = new PlaybackEngine();
