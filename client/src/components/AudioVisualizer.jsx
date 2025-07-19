import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Download } from 'lucide-react';

const AudioVisualizer = ({ 
  audioNarration, 
  storyTitle = "Story Narration",
  onSceneChange = () => {} 
}) => {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate scene timing
  const sceneTimings = React.useMemo(() => {
    if (!audioNarration?.scenes) return [];
    
    let accumTime = 0;
    return audioNarration.scenes.map((scene, index) => {
      const startTime = accumTime;
      const endTime = accumTime + scene.duration;
      accumTime = endTime;
      return {
        ...scene,
        startTime,
        endTime,
        index
      };
    });
  }, [audioNarration]);

  // Update current scene based on time
  useEffect(() => {
    const newScene = sceneTimings.findIndex(scene => 
      currentTime >= scene.startTime && currentTime < scene.endTime
    );
    if (newScene !== -1 && newScene !== currentScene) {
      setCurrentScene(newScene);
      onSceneChange(newScene);
    }
  }, [currentTime, sceneTimings, currentScene, onSceneChange]);

  // Set up audio context and analyser
  const setupAudioContext = async () => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(audioRef.current);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
    } catch (error) {
      console.error('Error setting up audio context:', error);
    }
  };

  // Draw visualizer
  const draw = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) {
      animationRef.current = requestAnimationFrame(draw);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    analyser.getByteFrequencyData(dataArray);

    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw bars
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(0.5, '#06b6d4');
    gradient.addColorStop(1, '#8b5cf6');

    for (let i = 0; i < dataArray.length; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }

    // Draw waveform overlay
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = canvas.width * 1.0 / dataArray.length;
    x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    animationRef.current = requestAnimationFrame(draw);
  };

  // Handle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      setIsLoading(true);
      
      if (isPlaying) {
        await audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await setupAudioContext();
        await audioRef.current.play();
        setIsPlaying(true);
        
        if (!animationRef.current) {
          draw();
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Jump to scene
  const jumpToScene = (sceneIndex) => {
    if (!audioRef.current || !sceneTimings[sceneIndex]) return;
    
    audioRef.current.currentTime = sceneTimings[sceneIndex].startTime;
    setCurrentScene(sceneIndex);
  };

  // Skip forward/backward
  const skipForward = () => {
    const nextScene = Math.min(currentScene + 1, sceneTimings.length - 1);
    jumpToScene(nextScene);
  };

  const skipBackward = () => {
    const prevScene = Math.max(currentScene - 1, 0);
    jumpToScene(prevScene);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentScene(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnd);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnd);
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  if (!audioNarration) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <div className="text-gray-400 mb-4">
          <Volume2 size={48} className="mx-auto opacity-50" />
        </div>
        <p className="text-gray-300">No audio narration available</p>
        <p className="text-gray-500 text-sm mt-2">Enable voice generation to create audio stories</p>
      </div>
    );
  }

  // Get first scene audio URL or use a main audio URL
  const audioUrl = audioNarration.scenes?.[0]?.audio_url || audioNarration.audio_url;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 space-y-6">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onVolumeChange={(e) => setVolume(e.target.volume)}
      />

      {/* Title */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">{storyTitle}</h3>
        <p className="text-gray-400 text-sm">
          {audioNarration.scenes?.length || 0} scenes • {formatTime(audioNarration.total_duration || 0)}
        </p>
      </div>

      {/* Visualizer Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full h-30 bg-gray-900 rounded-lg border border-gray-700"
        />
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500 text-center">
              <Volume2 size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Press play to see visualization</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={(e) => {
            if (audioRef.current) {
              audioRef.current.currentTime = e.target.value;
            }
          }}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer opacity-0 absolute"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={skipBackward}
          disabled={currentScene === 0}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SkipBack size={20} className="text-white" />
        </button>
        
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="p-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause size={24} className="text-white" />
          ) : (
            <Play size={24} className="text-white ml-1" />
          )}
        </button>
        
        <button
          onClick={skipForward}
          disabled={currentScene >= sceneTimings.length - 1}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward size={20} className="text-white" />
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3">
        <Volume2 size={16} className="text-gray-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => {
            const newVolume = e.target.value;
            setVolume(newVolume);
            if (audioRef.current) {
              audioRef.current.volume = newVolume;
            }
          }}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-gray-400 text-sm min-w-8">{Math.round(volume * 100)}%</span>
      </div>

      {/* Scene Navigation */}
      {sceneTimings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300">Scenes</h4>
          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
            {sceneTimings.map((scene, index) => (
              <button
                key={scene.scene_id}
                onClick={() => jumpToScene(index)}
                className={`text-left p-3 rounded-lg transition-all ${
                  currentScene === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{scene.scene_number}. {scene.text?.substring(0, 30)}...</span>
                  <span className="text-xs opacity-75">{formatTime(scene.duration)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Download Button */}
      {audioUrl && (
        <div className="pt-4 border-t border-gray-700">
          <a
            href={audioUrl}
            download={`${storyTitle}-narration.mp3`}
            className="flex items-center justify-center space-x-2 w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Download size={16} className="text-gray-300" />
            <span className="text-gray-300 text-sm">Download Audio</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
