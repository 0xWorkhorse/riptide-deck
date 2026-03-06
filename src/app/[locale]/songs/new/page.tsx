'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Music,
  Users,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  ChevronLeft,
  PieChart,
  X,
  MessageSquare,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Contributor {
  name: string;
  role: string;
  ipi: string;
  pro: string;
  splitPercent: number;
  splitType: 'music' | 'lyrics';
}

interface SongData {
  title: string;
  artist: string;
  album: string;
  recordLabel: string;
  isInstrumental: boolean;
  contributors: Contributor[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ROLES = [
  'songwriter',
  'composer',
  'lyricist',
  'producer',
  'arranger',
  'instrumentalist',
  'vocalist',
  'session_musician',
  'engineer',
] as const;

const PROS = ['ASCAP', 'BMI', 'SESAC', 'GMR', 'SOCAN', 'PRS', 'GEMA', 'SACEM', 'JASRAC', ''] as const;

/* ------------------------------------------------------------------ */
/*  Chat Interface                                                     */
/* ------------------------------------------------------------------ */

function ChatInterface({
  onParsed,
  messages,
  setMessages,
}: {
  onParsed: (data: Partial<SongData>) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
  const t = useTranslations('songs');
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [context, setContext] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processStory = useCallback(async (story: string) => {
    if (!story.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: story, timestamp: new Date() }]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/songs/parse-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, context }),
      });

      if (!res.ok) throw new Error('Failed to parse story');
      const data = await res.json();
      const parsed = data.parsed;

      // Build response message
      let response = '';
      if (parsed.title || parsed.artist || parsed.contributors.length > 0) {
        response += t('chat.foundInfo') + '\n\n';
        if (parsed.title) response += `**${t('form.title')}:** ${parsed.title}\n`;
        if (parsed.artist) response += `**${t('form.artist')}:** ${parsed.artist}\n`;
        if (parsed.album) response += `**${t('form.album')}:** ${parsed.album}\n`;
        if (parsed.recordLabel) response += `**${t('form.recordLabel')}:** ${parsed.recordLabel}\n`;
        if (parsed.contributors.length > 0) {
          response += `\n**${t('form.contributors')}:**\n`;
          for (const c of parsed.contributors) {
            response += `- ${c.name} (${c.role})\n`;
          }
        }
      }

      if (parsed.followUpQuestions.length > 0) {
        response += '\n' + t('chat.questionsNeeded') + '\n';
        for (const q of parsed.followUpQuestions) {
          response += `- ${q}\n`;
        }
      }

      if (!response) {
        response = t('chat.couldNotParse');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);

      // Update context with what we found
      const newContext = { ...context };
      if (parsed.title) newContext.title = parsed.title;
      if (parsed.artist) newContext.artist = parsed.artist;
      if (parsed.album) newContext.album = parsed.album;
      if (parsed.recordLabel) newContext.recordLabel = parsed.recordLabel;
      setContext(newContext);

      // Send parsed data to parent
      const songData: Partial<SongData> = {};
      if (parsed.title) songData.title = parsed.title;
      if (parsed.artist) songData.artist = parsed.artist;
      if (parsed.album) songData.album = parsed.album;
      if (parsed.recordLabel) songData.recordLabel = parsed.recordLabel;
      if (parsed.contributors.length > 0) {
        songData.contributors = parsed.contributors.map((c: { name: string; role: string; splitType: string }) => ({
          name: c.name,
          role: c.role,
          ipi: '',
          pro: '',
          splitPercent: 0,
          splitType: c.splitType === 'lyrics' ? 'lyrics' as const : 'music' as const,
        }));
      }
      onParsed(songData);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('chat.error'), timestamp: new Date() },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, [context, onParsed, setMessages, t]);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    const text = input;
    setInput('');
    processStory(text);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('chat.noSpeech'), timestamp: new Date() },
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ');
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  return (
    <div className="card flex h-[500px] flex-col overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-3">
        <MessageSquare className="h-5 w-5 text-brand-400" />
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{t('chat.title')}</h3>
          <p className="text-xs text-text-muted">{t('chat.subtitle')}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Music className="mx-auto h-12 w-12 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">{t('chat.prompt')}</p>
              <p className="mt-1 text-xs text-text-muted">{t('chat.promptHint')}</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-2 text-text-primary'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <p className={`mt-1 text-[10px] ${msg.role === 'user' ? 'text-white/60' : 'text-text-muted'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-surface-2 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-subtle p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              isRecording
                ? 'bg-status-removed/20 text-status-removed animate-pulse'
                : 'bg-surface-2 text-text-secondary hover:text-text-primary'
            }`}
            title={isRecording ? t('chat.stopRecording') : t('chat.startRecording')}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('chat.inputPlaceholder')}
            className="flex-1 rounded-lg border border-border-default bg-surface-1 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40 disabled:hover:bg-brand-500"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Song Registration Form                                             */
/* ------------------------------------------------------------------ */

function SongForm({
  song,
  setSong,
  onSave,
  saving,
}: {
  song: SongData;
  setSong: React.Dispatch<React.SetStateAction<SongData>>;
  onSave: () => void;
  saving: boolean;
}) {
  const t = useTranslations('songs');

  const totalSplits = song.contributors.reduce((sum, c) => sum + c.splitPercent, 0);
  const isValid = song.title.trim().length > 0 && Math.abs(totalSplits - 100) < 0.01;

  const addContributor = () => {
    setSong((prev) => ({
      ...prev,
      contributors: [
        ...prev.contributors,
        { name: '', role: 'songwriter', ipi: '', pro: '', splitPercent: 0, splitType: 'music' },
      ],
    }));
  };

  const removeContributor = (index: number) => {
    setSong((prev) => ({
      ...prev,
      contributors: prev.contributors.filter((_, i) => i !== index),
    }));
  };

  const updateContributor = (index: number, field: keyof Contributor, value: string | number) => {
    setSong((prev) => ({
      ...prev,
      contributors: prev.contributors.map((c, i) =>
        i === index ? { ...c, [field]: value } : c,
      ),
    }));
  };

  const toggleInstrumental = () => {
    setSong((prev) => {
      const newIsInstrumental = !prev.isInstrumental;
      let updatedContributors = prev.contributors;

      if (newIsInstrumental) {
        // Redistribute lyrics splits to music
        const lyricWriters = updatedContributors.filter((c) => c.splitType === 'lyrics');
        const musicWriters = updatedContributors.filter((c) => c.splitType === 'music');
        const lyricTotal = lyricWriters.reduce((sum, c) => sum + c.splitPercent, 0);

        if (lyricTotal > 0 && musicWriters.length > 0) {
          const perWriter = lyricTotal / musicWriters.length;
          updatedContributors = updatedContributors.map((c) => ({
            ...c,
            splitPercent: c.splitType === 'lyrics' ? 0 : c.splitPercent + perWriter,
            splitType: 'music' as const,
          }));
        } else {
          updatedContributors = updatedContributors.map((c) => ({ ...c, splitType: 'music' as const }));
        }
      }

      return { ...prev, isInstrumental: newIsInstrumental, contributors: updatedContributors };
    });
  };

  const distributeSplitsEvenly = () => {
    const songwriters = song.contributors.filter(
      (c) => c.role === 'songwriter' || c.role === 'composer' || c.role === 'lyricist',
    );
    if (songwriters.length === 0) return;

    const perWriter = Math.round((100 / songwriters.length) * 100) / 100;
    let remaining = 100;

    setSong((prev) => ({
      ...prev,
      contributors: prev.contributors.map((c, i) => {
        const isSongwriter = c.role === 'songwriter' || c.role === 'composer' || c.role === 'lyricist';
        if (!isSongwriter) return { ...c, splitPercent: 0 };

        // Give remainder to last songwriter
        const isLastSongwriter = prev.contributors
          .slice(i + 1)
          .every((cc) => cc.role !== 'songwriter' && cc.role !== 'composer' && cc.role !== 'lyricist');

        if (isLastSongwriter) {
          const share = Math.round(remaining * 100) / 100;
          remaining = 0;
          return { ...c, splitPercent: share };
        }
        remaining -= perWriter;
        return { ...c, splitPercent: perWriter };
      }),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Song Metadata */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Music className="h-4 w-4 text-brand-400" />
          {t('form.songInfo')}
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('form.title')} <span className="text-status-removed">*</span>
            </label>
            <input
              type="text"
              value={song.title}
              onChange={(e) => setSong((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={t('form.titlePlaceholder')}
              className="w-full rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('form.artist')}
            </label>
            <input
              type="text"
              value={song.artist}
              onChange={(e) => setSong((prev) => ({ ...prev, artist: e.target.value }))}
              placeholder={t('form.artistPlaceholder')}
              className="w-full rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('form.album')}
            </label>
            <input
              type="text"
              value={song.album}
              onChange={(e) => setSong((prev) => ({ ...prev, album: e.target.value }))}
              placeholder={t('form.albumPlaceholder')}
              className="w-full rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('form.recordLabel')}
            </label>
            <input
              type="text"
              value={song.recordLabel}
              onChange={(e) => setSong((prev) => ({ ...prev, recordLabel: e.target.value }))}
              placeholder={t('form.recordLabelPlaceholder')}
              className="w-full rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Instrumental toggle */}
        <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3">
          <button
            onClick={toggleInstrumental}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              song.isInstrumental ? 'bg-brand-500' : 'bg-surface-3'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                song.isInstrumental ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-text-primary">{t('form.instrumental')}</p>
            <p className="text-xs text-text-muted">{t('form.instrumentalHint')}</p>
          </div>
        </div>
      </div>

      {/* Contributors */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-400" />
            {t('form.contributors')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={distributeSplitsEvenly}
              className="btn-ghost flex items-center gap-1 !px-2 !py-1 text-xs"
              title={t('form.distributeSplits')}
            >
              <PieChart className="h-3 w-3" />
              {t('form.distributeSplits')}
            </button>
            <button
              onClick={addContributor}
              className="btn-primary flex items-center gap-1 !px-3 !py-1.5 text-xs"
            >
              <Plus className="h-3 w-3" />
              {t('form.addContributor')}
            </button>
          </div>
        </div>

        {/* Split total indicator */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                Math.abs(totalSplits - 100) < 0.01
                  ? 'bg-status-matched'
                  : totalSplits > 100
                    ? 'bg-status-removed'
                    : 'bg-status-modified'
              }`}
              style={{ width: `${Math.min(totalSplits, 100)}%` }}
            />
          </div>
          <span
            className={`text-xs font-mono font-semibold ${
              Math.abs(totalSplits - 100) < 0.01
                ? 'text-status-matched'
                : 'text-status-modified'
            }`}
          >
            {totalSplits.toFixed(2)}%
          </span>
        </div>

        {/* Contributor rows */}
        {song.contributors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default py-8 text-center">
            <Users className="mx-auto h-8 w-8 text-text-muted" />
            <p className="mt-2 text-sm text-text-muted">{t('form.noContributors')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {song.contributors.map((contributor, index) => (
              <div
                key={index}
                className="rounded-lg border border-border-subtle bg-surface-2/50 p-3"
              >
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Name */}
                  <div className="col-span-3">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      {t('form.name')}
                    </label>
                    <input
                      type="text"
                      value={contributor.name}
                      onChange={(e) => updateContributor(index, 'name', e.target.value)}
                      placeholder="e.g. John Smith"
                      className="w-full rounded border border-border-default bg-surface-1 px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
                    />
                  </div>

                  {/* Role */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      {t('form.role')}
                    </label>
                    <select
                      value={contributor.role}
                      onChange={(e) => updateContributor(index, 'role', e.target.value)}
                      className="w-full rounded border border-border-default bg-surface-1 px-2 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`roles.${role}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* PRO */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      PRO
                    </label>
                    <select
                      value={contributor.pro}
                      onChange={(e) => updateContributor(index, 'pro', e.target.value)}
                      className="w-full rounded border border-border-default bg-surface-1 px-2 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                    >
                      {PROS.map((pro) => (
                        <option key={pro} value={pro}>
                          {pro || '—'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* IPI */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      IPI
                    </label>
                    <input
                      type="text"
                      value={contributor.ipi}
                      onChange={(e) => updateContributor(index, 'ipi', e.target.value)}
                      placeholder="IPI #"
                      className="w-full rounded border border-border-default bg-surface-1 px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
                    />
                  </div>

                  {/* Split */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      {t('form.split')} (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={contributor.splitPercent}
                      onChange={(e) => updateContributor(index, 'splitPercent', parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-border-default bg-surface-1 px-2 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                    />
                  </div>

                  {/* Delete */}
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeContributor(index)}
                      className="rounded p-1.5 text-text-muted hover:bg-status-removed/10 hover:text-status-removed transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Split type selector (when not instrumental) */}
                {!song.isInstrumental && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">{t('form.splitType')}:</span>
                    <button
                      onClick={() => updateContributor(index, 'splitType', 'music')}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        contributor.splitType === 'music'
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-surface-3 text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {t('form.music')}
                    </button>
                    <button
                      onClick={() => updateContributor(index, 'splitType', 'lyrics')}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        contributor.splitType === 'lyrics'
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-surface-3 text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {t('form.lyrics')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div>
          {!isValid && song.title.trim().length > 0 && Math.abs(totalSplits - 100) > 0.01 && (
            <p className="flex items-center gap-1 text-xs text-status-modified">
              <AlertCircle className="h-3 w-3" />
              {t('form.splitsWarning', { total: totalSplits.toFixed(2) })}
            </p>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={!isValid || saving}
          className="btn-primary flex items-center gap-2 !px-6"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {t('form.register')}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Story to Splits Page                                                */
/* ================================================================== */

export default function StoryToSplitsPage() {
  const t = useTranslations('songs');
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [song, setSong] = useState<SongData>({
    title: '',
    artist: '',
    album: '',
    recordLabel: '',
    isInstrumental: false,
    contributors: [],
  });

  const handleParsed = (data: Partial<SongData>) => {
    setSong((prev) => ({
      ...prev,
      ...data,
      contributors: data.contributors && data.contributors.length > 0
        ? data.contributors
        : prev.contributors,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            recordLabel: song.recordLabel,
            isInstrumental: song.isInstrumental,
            sourceType: 'story',
            status: 'registered',
          },
          contributors: song.contributors.map((c) => ({
            name: c.name,
            role: c.role,
            ipi: c.ipi,
            pro: c.pro,
            splitPercent: c.splitPercent,
            splitType: c.splitType,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to register song');
      setSuccess(true);
      setTimeout(() => router.push('/songs'), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-matched/20">
            <Check className="h-8 w-8 text-status-matched" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">{t('form.registered')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('form.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/songs')} className="btn-ghost !p-2">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('newTitle')}</h1>
          <p className="text-sm text-text-secondary">{t('newSubtitle')}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-status-removed/10 px-4 py-3 text-sm text-status-removed">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Left: Chat interface */}
        <div>
          <ChatInterface onParsed={handleParsed} messages={messages} setMessages={setMessages} />
        </div>

        {/* Right: Song form */}
        <div>
          <SongForm song={song} setSong={setSong} onSave={handleSave} saving={saving} />
        </div>
      </div>
    </div>
  );
}
