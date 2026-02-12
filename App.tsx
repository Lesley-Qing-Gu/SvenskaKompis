
import React, { useState, useRef, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Level, CoachRequest, SwedishCoachResponse, SpeechEvaluationResponse } from './types';
import { generateSwedishLesson, generateSpeech, evaluateSpeech } from './services/geminiService';

const SWEDISH_TOPICS = [
  "Berätta om din favoritplats i Sverige. (说说你在瑞典最喜欢的地方)",
  "Vad tycker du om det svenska vädret? (你觉得瑞典的天气怎么样？)",
  "Hur firar man en perfekt midsommar? (如何庆祝一个完美的仲夏节？)",
  "Beskriv din morgonrutin på svenska. (用瑞典语描述你的早晨例行公事)",
  "Vad är din favoriträtt i det svenska köket? (你最喜欢的瑞典菜是什么？)",
  "Diskutera begreppet 'lagom'. Vad betyder det för dig? (讨论 'lagom' 这个概念，它对你意味着什么？)",
  "Hur ser en typisk lördag ut för dig? (你典型的周六是怎么度过的？)",
  "Vad är det svåraste med att lära sig svenska? (学习瑞典语最难的部分是什么？)",
  "Berätta om en svensk tradition du gillar. (说说你喜欢的一个瑞典传统)",
  "Om du fick flytta till vilken stad som helst i Sverige, vilken skulle det vara? (如果你可以搬到瑞典的任何城市，你会选哪一个？)",
  "Varför vill du lära dig svenska? (你为什么要学习瑞典语？)",
  "Berätta om din favoritbok eller film. (说说你最喜欢的书或电影)",
  "Hur hanterar du mörkret under den svenska vintern? (你是如何应对瑞典冬天的黑暗的？)",
  "Vad är 'fika' för dig? (对你来说 'fika' 是什么？)",
  "Beskriv din familj på svenska. (用瑞典语描述你的家庭)",
  "Vilken är din favoritårstid i Sverige och varför? (瑞典你最喜欢的季节是哪一个，为什么？)",
  "Prata om ditt drömjobb. (谈谈你的梦想职业)",
  "Hur tycker du att det svenska fikasystemet fungerar på jobbet? (你觉得职场中的瑞典 fika 文化怎么样？)",
  "Berätta om en resa du har gjort. (说说你的一次旅行经历)",
  "Vad tänker du på när du hör ordet 'Sverige'? (当你听到 '瑞典' 这个词时，你会想到什么？)"
];

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

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

type Mode = 'DIALOGUE' | 'LAB';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('DIALOGUE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio playback state
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Dialogue Generation state
  const [request, setRequest] = useState<CoachRequest>({
    scenario: '在咖啡店点单 (Ordering at a cafe)',
    level: Level.SFICD,
    keywords: 'påtår, kardemummabulle, fika'
  });
  const [lesson, setLesson] = useState<SwedishCoachResponse | null>(null);

  // Speech Lab state
  const [labTopic, setLabTopic] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [evaluation, setEvaluation] = useState<SpeechEvaluationResponse | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const generateRandomTopic = () => {
    const randomIndex = Math.floor(Math.random() * SWEDISH_TOPICS.length);
    setLabTopic(SWEDISH_TOPICS[randomIndex]);
    setEvaluation(null);
  };

  useEffect(() => {
    // Initialize first topic
    generateRandomTopic();
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await generateSwedishLesson(request);
      setLesson(result);
    } catch (err) {
      setError('Oj! Something went wrong generating the lesson.');
    } finally {
      setLoading(false);
    }
  };

  const playSwedishAudio = async (text: string, id: string) => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
    }
    if (playingAudio === id) { setPlayingAudio(null); return; }
    setPlayingAudio(id);
    try {
      const base64 = await generateSpeech(text);
      if (!base64) throw new Error("No audio data");
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => { if (playingAudio === id) setPlayingAudio(null); };
      currentSourceRef.current = source;
      source.start();
    } catch (err) {
      setError("Playback failed. Please try again.");
      setPlayingAudio(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          await processSpeechEvaluation(base64String);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setEvaluation(null);
    } catch (err) {
      setError("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processSpeechEvaluation = async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await evaluateSpeech(base64, labTopic);
      setEvaluation(result);
    } catch (err) {
      console.error(err);
      setError("Speech analysis failed. The audio might be too short or too long.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5 flex mb-6">
            <button 
              onClick={() => { setMode('DIALOGUE'); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'DIALOGUE' ? 'nordic-gradient text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              情景对话
            </button>
            <button 
              onClick={() => { 
                setMode('LAB'); 
                setError(null);
                generateRandomTopic(); // Auto-generate on entry
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${mode === 'LAB' ? 'nordic-gradient text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              语音实验室
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
              <i className={`fa-solid ${mode === 'DIALOGUE' ? 'fa-sliders' : 'fa-microphone-lines'} text-blue-600`}></i>
              {mode === 'DIALOGUE' ? '定制对话' : '口语评测'}
            </h2>

            {mode === 'DIALOGUE' ? (
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">场景 (Scenario)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    value={request.scenario}
                    onChange={(e) => setRequest({ ...request, scenario: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">难度 (Level)</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={request.level}
                    onChange={(e) => setRequest({ ...request, level: e.target.value as Level })}
                  >
                    {Object.values(Level).map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">关键词</label>
                  <textarea
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-20 outline-none"
                    value={request.keywords}
                    onChange={(e) => setRequest({ ...request, keywords: e.target.value })}
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 nordic-gradient text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50">
                  {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : '开始练习'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">练习主题 (Topic)</label>
                  <button 
                    onClick={generateRandomTopic}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
                  >
                    <i className="fa-solid fa-shuffle"></i> 换一个
                  </button>
                </div>
                <div className="relative group">
                   <textarea
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-28 outline-none text-slate-800 font-medium text-sm resize-none"
                    value={labTopic}
                    onChange={(e) => setLabTopic(e.target.value)}
                  />
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <i className="fa-solid fa-lightbulb mr-1"></i>
                    我已经为你准备了一个有趣的话题。如果你想练习别的，可以直接修改文字或点击“换一个”。
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
              <i className="fa-solid fa-circle-exclamation text-xl"></i>
              <div className="flex-1 text-sm">{error}</div>
              <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100"><i className="fa-solid fa-xmark"></i></button>
            </div>
          )}

          {mode === 'DIALOGUE' ? (
            lesson ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <i className="fa-solid fa-comments text-blue-500"></i>情景对话
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {lesson.dialogue.map((line, idx) => {
                      const id = `line-${idx}`;
                      const isPlaying = playingAudio === id;
                      return (
                        <div key={idx} className={`flex flex-col ${idx % 2 === 0 ? 'items-start' : 'items-end'}`}>
                          <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${idx % 2 === 0 ? 'bg-blue-50 text-blue-900 rounded-tl-none' : 'bg-emerald-50 text-emerald-900 rounded-tr-none'}`}>
                            <div className="flex justify-between items-start gap-4">
                              <p className="text-lg font-medium">{line.swedish}</p>
                              <button onClick={() => playSwedishAudio(line.swedish, id)} className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isPlaying ? 'bg-blue-600 text-white animate-pulse' : 'bg-white/50 text-slate-600'}`}>
                                <i className={`fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'} text-xs`}></i>
                              </button>
                            </div>
                            <p className="text-sm opacity-60 mt-2 border-t border-current/10 pt-2">{line.chinese}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
                
                <section className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-globe"></i>文化贴士
                  </h2>
                  <p className="text-lg leading-relaxed font-light italic">{lesson.culturalTip}</p>
                </section>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 h-[500px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <i className="fa-solid fa-language text-4xl mb-4"></i>
                <h3 className="text-xl font-medium text-slate-600">选择一个场景开始学习</h3>
              </div>
            )
          ) : (
            /* Speech Lab View */
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center text-center">
                <div className="bg-blue-50 px-6 py-4 rounded-2xl border border-blue-100 mb-10 max-w-lg">
                  <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 block">今日挑战主题</span>
                  <p className="text-lg font-bold text-slate-800 leading-snug">{labTopic}</p>
                </div>

                <div className="relative mb-8">
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={loading}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl relative z-10 ${isRecording ? 'bg-red-500 animate-pulse ring-8 ring-red-100' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-slate-300 disabled:ring-0`}
                  >
                    {loading ? (
                      <i className="fa-solid fa-spinner fa-spin text-white text-3xl"></i>
                    ) : isRecording ? (
                      <i className="fa-solid fa-stop text-white text-3xl"></i>
                    ) : (
                      <i className="fa-solid fa-microphone text-white text-3xl"></i>
                    )}
                  </button>
                  {isRecording && (
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 font-mono font-bold text-red-500">
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{isRecording ? '正在倾听...' : loading ? 'AI 正在分析录音...' : '点击开始录音'}</h3>
                <p className="text-slate-500 mt-2 max-w-sm">录音完成后，我会为您转录内容并从语法和发音维度进行详细评价。</p>
              </div>

              {evaluation && !loading && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center group hover:border-blue-300 transition-colors">
                      <div className="text-4xl font-black text-blue-600 mb-1">{evaluation.contentScore}</div>
                      <div className="text-xs uppercase font-bold text-slate-400 tracking-widest">内容评分</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center group hover:border-emerald-300 transition-colors">
                      <div className="text-4xl font-black text-emerald-600 mb-1">{evaluation.pronunciationScore}</div>
                      <div className="text-xs uppercase font-bold text-slate-400 tracking-widest">发音评分</div>
                    </div>
                  </div>

                  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-quote-left text-blue-500"></i>识别结果 (Transkript)
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-xl italic text-slate-700 border-l-4 border-blue-500">
                      "{evaluation.transcript}"
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                      <h4 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-circle-check"></i>做得好的地方
                      </h4>
                      <ul className="space-y-2">
                        {evaluation.strengths.map((s, i) => <li key={i} className="text-sm text-emerald-800 flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0"></span>{s}</li>)}
                      </ul>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                      <h4 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-circle-arrow-up"></i>可以改进的地方
                      </h4>
                      <ul className="space-y-2">
                        {evaluation.improvements.map((im, i) => <li key={i} className="text-sm text-amber-800 flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"></span>{im}</li>)}
                      </ul>
                    </div>
                  </div>

                  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-chalkboard-user text-blue-500"></i>专家建议 (Analys)
                    </h4>
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="w-1 bg-blue-200 rounded-full"></div>
                        <div>
                          <h5 className="text-xs font-bold text-blue-600 uppercase mb-1 tracking-wider">语法与用词</h5>
                          <p className="text-sm text-slate-600 leading-relaxed">{evaluation.grammarNotes}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-1 bg-emerald-200 rounded-full"></div>
                        <div>
                          <h5 className="text-xs font-bold text-emerald-600 uppercase mb-1 tracking-wider">发音与韵律</h5>
                          <p className="text-sm text-slate-600 leading-relaxed">{evaluation.pronunciationNotes}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default App;
