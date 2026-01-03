'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

interface LinkedRundownItem {
  id: string;
  title: string;
  script: string | null;
  duration: number;
  type: string;
  position: number;
}

interface LinkedRundownInfo {
  id: string;
  showName: string;
  assigneeName: string | null;
  endCues: string[];
  items: LinkedRundownItem[];
}

interface PrompterSection {
  id: string;
  time: string;
  title: string;
  type: string;
  duration: number;
  content: string;
  soundCues: { title: string; duration: number | null }[];
  notes: string | null;
  linkedRundown?: LinkedRundownInfo;
}

interface PageProps {
  params: { rundownId: string };
}

// Heights for fixed header and footer
const HEADER_HEIGHT = 64; // px
const FOOTER_HEIGHT = 100; // px

export default function PrompterPage({ params }: PageProps) {
  const { rundownId } = params;

  const { data, isLoading, error } = trpc.script.getAssembled.useQuery({
    rundownId,
  });

  // Prompter state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.0); // 0.5 to 2.0
  const [fontSize, setFontSize] = useState(36);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLinkedDetails, setShowLinkedDetails] = useState(true); // Toggle pour afficher/masquer les details des conducteurs imbriques

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer for elapsed time when scrolling
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isScrolling) {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isScrolling]);

  // Auto scroll - FIXED VERSION
  useEffect(() => {
    if (isScrolling && contentRef.current) {
      // Clear any existing interval first
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }

      scrollIntervalRef.current = setInterval(() => {
        if (contentRef.current) {
          // Scroll speed: 1.0 = ~30px/sec, 2.0 = ~60px/sec
          const pixelsPerTick = scrollSpeed * 2;
          contentRef.current.scrollTop += pixelsPerTick;
        }
      }, 50); // 20 ticks per second
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [isScrolling, scrollSpeed]);

  // Detect which section is currently visible based on scroll position
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !data?.sections) return;

    const handleScroll = () => {
      // The sight line is at HEADER_HEIGHT + 150 from the top of the viewport
      const sightLineY = 150; // Relative to the container's visible area

      let visibleSectionIndex = 0;

      for (let i = 0; i < data.sections.length; i++) {
        const sectionEl = document.getElementById(`section-${i}`);
        if (sectionEl) {
          const rect = sectionEl.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Calculate section position relative to container
          const sectionTopInContainer = rect.top - containerRect.top;

          // If this section is at or above the sight line, it's the current one
          if (sectionTopInContainer <= sightLineY) {
            visibleSectionIndex = i;
          } else {
            break;
          }
        }
      }

      setCurrentSectionIndex(visibleSectionIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [data?.sections]);

  // Scroll to a specific section
  const scrollToSection = useCallback((index: number) => {
    const sectionEl = document.getElementById(`section-${index}`);
    if (sectionEl && contentRef.current) {
      // Calculate the offset accounting for the sight line (middle of visible area)
      const containerHeight = contentRef.current.clientHeight;
      const sectionTop = sectionEl.offsetTop;
      const targetScroll = sectionTop - (containerHeight / 3);
      
      contentRef.current.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, []);

  // Keyboard controls
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsScrolling((prev) => !prev);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (contentRef.current) {
            contentRef.current.scrollTop -= 100;
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (contentRef.current) {
            contentRef.current.scrollTop += 100;
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentSectionIndex((prev) => {
            const newIndex = Math.max(0, prev - 1);
            setTimeout(() => scrollToSection(newIndex), 50);
            return newIndex;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (data?.sections) {
            setCurrentSectionIndex((prev) => {
              const newIndex = Math.min(data.sections.length - 1, prev + 1);
              setTimeout(() => scrollToSection(newIndex), 50);
              return newIndex;
            });
          }
          break;
        case 'Equal': // +
        case 'NumpadAdd':
          e.preventDefault();
          setScrollSpeed((prev) => Math.min(2.0, +(prev + 0.1).toFixed(1)));
          break;
        case 'Minus': // -
        case 'NumpadSubtract':
          e.preventDefault();
          setScrollSpeed((prev) => Math.max(0.3, +(prev - 0.1).toFixed(1)));
          break;
        case 'KeyA':
          e.preventDefault();
          setFontSize((prev) => Math.min(72, prev + 4));
          break;
        case 'KeyZ':
          e.preventDefault();
          setFontSize((prev) => Math.max(20, prev - 4));
          break;
        case 'KeyF':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            document.documentElement.requestFullscreen?.();
          }
          break;
        case 'Escape':
          // Escape is handled natively for fullscreen
          break;
        case 'KeyR':
          e.preventDefault();
          setElapsedTime(0);
          break;
      }
    },
    [data?.sections, scrollToSection]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Format duration
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}'${s.toString().padStart(2, '0')}"` : `${m}'00"`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Chargement du script...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Conducteur non trouve</div>
          <p className="text-gray-400">
            {error?.message || 'Une erreur est survenue'}
          </p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const currentSection = data.sections[currentSectionIndex];
  const prevSection = data.sections[currentSectionIndex - 1];
  const nextSection = data.sections[currentSectionIndex + 1];

  return (
    <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden">
      {/* FIXED Header */}
      <header 
        className="fixed top-0 left-0 right-0 z-50 px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between"
        style={{ height: HEADER_HEIGHT }}
      >
        <div>
          <h1 className="text-lg font-semibold">{data.showName}</h1>
          <p className="text-sm text-gray-400">
            {format(new Date(data.date), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-3xl font-mono tabular-nums text-red-500 font-bold">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <button
            onClick={() => window.close()}
            className="text-gray-400 hover:text-white text-2xl"
            title="Fermer"
          >
            &times;
          </button>
        </div>
      </header>

      {/* Scrollable content area - FIXED POSITION */}
      <div
        ref={contentRef}
        className="fixed overflow-y-auto bg-gray-900"
        style={{
          top: HEADER_HEIGHT,
          left: 0,
          right: 0,
          bottom: FOOTER_HEIGHT,
          fontSize: `${fontSize}px`,
          lineHeight: 1.6,
        }}
      >
        {/* Sight line indicator (1/3 from top) */}
        <div 
          className="fixed left-0 right-0 h-1 bg-yellow-500/40 pointer-events-none z-10"
          style={{ top: HEADER_HEIGHT + 150 }}
        />
        <div 
          className="fixed left-0 right-0 h-px bg-yellow-500/20 pointer-events-none z-10"
          style={{ top: HEADER_HEIGHT + 149 }}
        />
        <div 
          className="fixed left-0 right-0 h-px bg-yellow-500/20 pointer-events-none z-10"
          style={{ top: HEADER_HEIGHT + 152 }}
        />

        {/* Content with padding */}
        <div className="max-w-4xl mx-auto px-12 py-8 space-y-12">
          {/* Initial spacer to start content below sight line */}
          <div className="h-32" />
          
          {data.sections.map((section, index) => (
            <section
              key={section.id}
              id={`section-${index}`}
              className={cn(
                'transition-opacity duration-300',
                index === currentSectionIndex ? 'opacity-100' : 'opacity-80'
              )}
            >
              {/* Section header */}
              <div className="mb-6 pb-2 border-b-2 border-gray-600">
                <div className="text-yellow-400 font-bold">
                  {section.time} - {section.title.toUpperCase()}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDuration(section.duration)}
                </div>
              </div>

              {/* Text content */}
              {section.content && (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {section.content}
                </div>
              )}

              {/* Sound cues */}
              {section.soundCues.length > 0 && (
                <div className="my-6 space-y-2">
                  {section.soundCues.map((cue, i) => (
                    <div
                      key={i}
                      className="bg-blue-900/50 border-2 border-blue-400 rounded-lg px-6 py-4 text-center"
                    >
                      <span className="text-blue-300 font-bold">&gt;&gt;&gt; SON : </span>
                      <span className="font-bold text-white">{cue.title}</span>
                      {cue.duration && (
                        <span className="text-blue-300 ml-2 font-bold">
                          ({formatDuration(cue.duration)}) &lt;&lt;&lt;
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Special marker for BREAK/JINGLE/MUSIC types without content */}
              {['BREAK', 'JINGLE', 'MUSIC'].includes(section.type) &&
                !section.content && (
                  <div className="text-center py-8 text-blue-300 font-bold text-xl">
                    &gt;&gt;&gt;{' '}
                    {section.type === 'BREAK' ? 'PUBLICITE' : section.type === 'MUSIC' ? 'MUSIQUE' : 'JINGLE'} :{' '}
                    {section.title}{' '}
                    ({formatDuration(section.duration)})
                    {' '}&lt;&lt;&lt;
                  </div>
                )}

              {/* Conducteur imbrique - Affichage complet */}
              {section.linkedRundown && (
                <div className="my-8">
                  {/* Header du bloc imbrique */}
                  <div className="bg-purple-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xl">
                        {section.linkedRundown.showName} — {section.linkedRundown.assigneeName || 'Autre presentateur'}
                      </div>
                      <div className="text-purple-200 text-sm">
                        Duree : {formatDuration(section.duration)}
                      </div>
                    </div>
                    {!showLinkedDetails && section.linkedRundown.items.length > 0 && (
                      <span className="text-purple-200 text-sm">
                        {section.linkedRundown.items.length} element{section.linkedRundown.items.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Contenu detaille du conducteur imbrique - conditionnel */}
                  {showLinkedDetails && section.linkedRundown.items.length > 0 && (
                    <div className="bg-purple-900/20 border-2 border-purple-500 border-t-0 p-6">
                      {section.linkedRundown.items.map((item, itemIndex) => (
                        <div key={item.id} className="mb-6 last:mb-0">
                          {/* Titre de l'element */}
                          <div className="text-purple-400 font-semibold text-lg mb-2">
                            {item.title}
                          </div>

                          {/* Texte du script */}
                          {item.script && (
                            <div className="text-purple-100 text-2xl leading-relaxed pl-4 border-l-4 border-purple-500 whitespace-pre-wrap">
                              {item.script}
                            </div>
                          )}

                          {/* Separateur entre elements */}
                          {itemIndex < section.linkedRundown!.items.length - 1 && (
                            <div className="border-b border-purple-500/30 mt-6" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Indicateur de fin et lien */}
                  <div className="bg-purple-600 text-white px-6 py-2 rounded-b-lg flex justify-between items-center text-sm">
                    <span>← Fin {section.linkedRundown.showName} — Reprise antenne</span>
                    <a
                      href={`/prompteur/${section.linkedRundown.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-200 underline hover:text-white"
                    >
                      Ouvrir le prompteur →
                    </a>
                  </div>
                </div>
              )}

              {/* Notes if any */}
              {section.notes && (
                <div className="mt-4 p-3 bg-gray-800 rounded text-sm text-gray-400 italic">
                  Note: {section.notes}
                </div>
              )}
            </section>
          ))}

          {/* End spacer to allow scrolling past the last section */}
          <div className="h-[60vh]" />
        </div>
      </div>

      {/* FIXED Footer - Controls */}
      <footer 
        className="fixed bottom-0 left-0 right-0 z-50 px-6 py-2 bg-gray-800 border-t border-gray-700"
        style={{ height: FOOTER_HEIGHT }}
      >
        {/* Navigation items */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              if (currentSectionIndex > 0) {
                const newIndex = currentSectionIndex - 1;
                setCurrentSectionIndex(newIndex);
                scrollToSection(newIndex);
              }
            }}
            disabled={currentSectionIndex === 0}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 min-w-[200px] text-left truncate"
          >
            {prevSection ? `< ${prevSection.title}` : ''}
          </button>

          <div className="text-center flex-1">
            <span className="text-yellow-400 font-semibold">
              {currentSection?.title}
            </span>
            <span className="text-gray-400 ml-2">
              ({formatDuration(currentSection?.duration || 0)})
            </span>
          </div>

          <button
            onClick={() => {
              if (currentSectionIndex < data.sections.length - 1) {
                const newIndex = currentSectionIndex + 1;
                setCurrentSectionIndex(newIndex);
                scrollToSection(newIndex);
              }
            }}
            disabled={currentSectionIndex >= data.sections.length - 1}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 min-w-[200px] text-right truncate"
          >
            {nextSection ? `${nextSection.title} >` : ''}
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsScrolling(!isScrolling)}
              className={cn(
                'px-4 py-2 rounded font-semibold transition-colors',
                isScrolling
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-green-600 text-white hover:bg-green-500'
              )}
            >
              {isScrolling ? '⏸ Pause' : '▶ Lecture'}
            </button>

            <span className="text-gray-500">[ESPACE]</span>
          </div>

          <div className="flex items-center gap-6 text-gray-400">
            <button
              onClick={() => setShowLinkedDetails(!showLinkedDetails)}
              className={cn(
                'px-3 py-1 rounded text-sm transition-colors',
                showLinkedDetails
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              )}
            >
              {showLinkedDetails ? 'Masquer details imbriques' : 'Afficher details imbriques'}
            </button>

            <div>
              <span className="text-gray-500 mr-1">[+/-]</span>
              Vitesse:{' '}
              <span className="text-white font-mono font-bold">
                {scrollSpeed.toFixed(1)}x
              </span>
            </div>

            <div>
              <span className="text-gray-500 mr-1">[A/Z]</span>
              Taille: <span className="text-white font-mono font-bold">{fontSize}px</span>
            </div>

            <div>
              <span className="text-gray-500 mr-1">[F]</span>
              Plein ecran
            </div>

            <div className="bg-gray-700 px-3 py-1 rounded">
              <span className="text-gray-400">Chrono: </span>
              <span className="text-yellow-400 font-mono font-bold tabular-nums">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
