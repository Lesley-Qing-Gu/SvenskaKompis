
import React, { useState, useRef } from 'react';
import { Layout } from './components/Layout';
import { Level, CoachRequest, SwedishCoachResponse } from './types';
import { generateSwedishLesson, generateSpeech } from './services/geminiService';

// Audio decoding utilities
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Ensure we handle potential byte offset issues and buffer length
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  const [request, setRequest] = useState<CoachRequest>({
    scenario: '在咖啡店点单 (Ordering at a cafe)',
    level: Level.SFICD,
    keywords: 'påtår, kardemummabulle, fika'
  });
  const [lesson, setLesson] = useState<SwedishCoachResponse | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await generateSwedishLesson(request);
      setLesson(result);
    } catch (err) {
      setError('Oj då! Something went wrong. Please check your API key or try again.');
    } finally {
      setLoading(false);
    }
  };

  const playSwedishAudio = async (text: string, id: string) => {
    // Stop previous audio if playing
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
      currentSourceRef.current = null;
    }

    if (playingAudio === id) {
      setPlayingAudio(null);
      return;
    }
    
    setPlayingAudio(id);
    try {
      const base64 = await generateSpeech(text);
      if (!base64) {
        throw new Error("Unable to retrieve speech audio from the server.");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      
      // Resume context if suspended (browser policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioData = decodeBase64(base64);
      const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (currentSourceRef.current === source) {
          setPlayingAudio(null);
          currentSourceRef.current = null;
        }
      };
      
      currentSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error("Playback error:", err);
      setError(err instanceof Error ? err.message : "Playback failed");
      setPlayingAudio(null);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-blue-600"></i>
              定制对话
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">场景 (Scenario)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder="e.g. 攀岩馆, 修自行车"
                  value={request.scenario}
                  onChange={(e) => setRequest({ ...request, scenario: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">难度 (Level)</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  value={request.level}
                  onChange={(e) => setRequest({ ...request, level: e.target.value as Level })}
                >
                  {Object.values(Level).map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">必填词汇 (Keywords)</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all h-24"
                  placeholder="e.g. påtår, fika"
                  value={request.keywords}
                  onChange={(e) => setRequest({ ...request, keywords: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${
                  loading ? 'bg-slate-400 cursor-not-allowed' : 'nordic-gradient shadow-md hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    生成中...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt"></i>
                    开始练习
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-sm text-blue-800">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <i className="fa-solid fa-circle-info"></i>
              学习小提示
            </h3>
            <p className="opacity-80">
              点击对话气泡旁的播放按钮，听听地道的瑞典语发音。尝试模仿语调和连读！
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
              <i className="fa-solid fa-circle-exclamation text-xl"></i>
              <div className="flex-1">
                <p className="font-bold">发生错误</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-900/50 hover:text-red-900">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          )}

          {!lesson && !loading && (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 h-[500px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <i className="fa-solid fa-language text-4xl"></i>
              </div>
              <h3 className="text-xl font-medium text-slate-600">准备好学习了吗？</h3>
              <p className="max-w-xs mt-2">在左侧输入你感兴趣的场景，我会为你生成一份完美的瑞典语教案。</p>
            </div>
          )}

          {loading && (
            <div className="space-y-6 animate-pulse">
              <div className="h-48 bg-slate-200 rounded-2xl"></div>
              <div className="h-64 bg-slate-200 rounded-2xl"></div>
            </div>
          )}

          {lesson && !loading && (
            <div className="space-y-8 pb-12">
              {/* Dialogue Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-comments text-blue-500"></i>
                    情景对话
                  </h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase">
                    {request.level.split(' ')[0]}
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  {lesson.dialogue.map((line, idx) => {
                    const lineId = `dialogue-${idx}`;
                    const isPlaying = playingAudio === lineId;
                    return (
                      <div key={idx} className={`flex flex-col ${idx % 2 === 0 ? 'items-start' : 'items-end'}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">{line.role}</span>
                        <div className={`group relative max-w-[85%] rounded-2xl p-4 shadow-sm ${
                          idx % 2 === 0 
                            ? 'bg-blue-50 text-blue-900 rounded-tl-none' 
                            : 'bg-emerald-50 text-emerald-900 rounded-tr-none'
                        }`}>
                          <div className="flex justify-between items-start gap-3">
                            <p className="text-lg leading-relaxed font-medium mb-2">{line.swedish}</p>
                            <button 
                              onClick={() => playSwedishAudio(line.swedish, lineId)}
                              disabled={!!playingAudio && !isPlaying}
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isPlaying 
                                  ? 'bg-blue-600 text-white animate-pulse' 
                                  : 'bg-white/50 hover:bg-white text-slate-600 shadow-sm'
                              }`}
                              title="Listen"
                            >
                              {isPlaying ? (
                                <i className="fa-solid fa-volume-high text-xs"></i>
                              ) : (
                                <i className="fa-solid fa-play text-[10px] ml-0.5"></i>
                              )}
                            </button>
                          </div>
                          <p className="text-sm opacity-70 border-t border-current/10 pt-2">{line.chinese}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Vocab & Pronunciation Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-book-open text-amber-500"></i>
                    核心词汇
                  </h2>
                  <ul className="space-y-3">
                    {lesson.vocabulary.map((v, i) => {
                      const vocabId = `vocab-${i}`;
                      const isPlaying = playingAudio === vocabId;
                      return (
                        <li key={i} className="group p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100 flex items-center justify-between">
                          <div className="flex-grow">
                            <div className="flex items-baseline gap-2">
                              <strong className="text-blue-600 text-lg">{v.term}</strong>
                              <span className="text-slate-500 text-sm">({v.translation})</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 italic">{v.info}</p>
                          </div>
                          <button 
                            onClick={() => playSwedishAudio(v.term, vocabId)}
                            disabled={!!playingAudio && !isPlaying}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              isPlaying 
                                ? 'bg-amber-500 text-white animate-pulse' 
                                : 'bg-slate-100 text-slate-400 group-hover:text-amber-500 group-hover:bg-amber-50'
                            }`}
                          >
                            <i className={`fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'} text-[10px]`}></i>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-ear-listen text-purple-500"></i>
                    发音要点
                  </h2>
                  <div className="space-y-4">
                    {lesson.pronunciation.map((p, i) => (
                      <div key={i} className="bg-purple-50 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-purple-900 text-md">{p.term}</h4>
                          <button 
                            onClick={() => playSwedishAudio(p.term, `pron-${i}`)}
                            className="text-purple-400 hover:text-purple-600"
                          >
                            <i className="fa-solid fa-volume-high text-xs"></i>
                          </button>
                        </div>
                        <p className="text-sm text-purple-800 leading-relaxed">{p.explanation}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Cultural Tip */}
              <section className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <i className="fa-solid fa-landmark text-9xl"></i>
                </div>
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-globe"></i>
                    文化贴士 (Kultur Tips)
                  </h2>
                  <p className="text-lg leading-relaxed font-light italic">
                    {lesson.culturalTip}
                  </p>
                </div>
              </section>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-4">
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-slate-800 text-white rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"
                >
                  <i className="fa-solid fa-print"></i> 打印教案
                </button>
                <button 
                  onClick={() => setLesson(null)}
                  className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <i className="fa-solid fa-rotate-left"></i> 重设场景
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default App;
