import React from 'react';

interface KeyboardProps {
  typedText: string;
  setTypedText: (text: string) => void;
  speakTypedText: () => void;
  onClose?: () => void;
  onOpenSos?: () => void;
  currentLayout: 'kor' | 'eng' | 'num';
  setCurrentLayout: (layout: 'kor' | 'eng' | 'num') => void;
  gazingId: string | null;
  handleMouseEnter: (id: string, action: () => void) => void;
  handleMouseLeave: () => void;
  handleManualClick: (action: () => void) => void;
  recommendations: string[];
}

export const keyboardLayouts = {
  kor: [
    ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
    ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ", "BACKSPACE"],
    ["TOGGLE_LANG", "ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ", "TOGGLE_NUM", "SPACE"]
  ],
  eng: [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "BACKSPACE"],
    ["TOGGLE_LANG", "z", "x", "c", "v", "b", "n", "m", "TOGGLE_NUM", "SPACE"]
  ],
  num: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["+", "-", "*", "/", "=", ".", "?", "!", ",", "BACKSPACE"],
    ["TOGGLE_LANG", "@", "#", "$", "%", "^", "&", "_", "TOGGLE_NUM", "SPACE"]
  ]
};

export const Keyboard: React.FC<KeyboardProps> = ({
  typedText,
  setTypedText,
  speakTypedText,
  onClose,
  onOpenSos,
  currentLayout,
  setCurrentLayout,
  gazingId,
  handleMouseEnter,
  handleMouseLeave,
  handleManualClick,
  recommendations
}) => {
  const handleKeyOrPhraseInput = (val: string, isPhrase = false) => {
    if (isPhrase) {
      setTypedText(val);
      return;
    }

    if (val === "TOGGLE_LANG") {
      setCurrentLayout(currentLayout === 'kor' ? 'eng' : 'kor');
    } else if (val === "TOGGLE_NUM") {
      setCurrentLayout(currentLayout === 'num' ? 'kor' : 'num');
    } else if (val === "BACKSPACE") {
      setTypedText(typedText.length > 0 ? typedText.substring(0, typedText.length - 1) : "");
    } else if (val === "SPACE") {
      setTypedText(typedText + " ");
    } else {
      setTypedText(typedText + val);
    }
  };

  const layoutContent = (
    <>
      {/* Text Display Board */}
      <div className="text-display-container">
        <div id="typed-text-preview" className={typedText.length === 0 ? "placeholder" : ""}>
          <span className="layout-badge" style={{ color: 'var(--color-ai)', fontWeight: 'bold', marginRight: '6px' }}>
            {currentLayout === 'kor' ? '[한글 자판]' : currentLayout === 'eng' ? '[영문 자판]' : '[숫자 자판]'}
          </span>
          {typedText.length === 0 ? "시선을 자판에 멈추거나 클릭하여 문장을 입력하세요..." : typedText}
        </div>
        <div className="text-actions">
          {onOpenSos && (
            <button
              id="btn-talk-sos"
              className={`text-action-btn gazeable ${gazingId === 'btn-talk-sos' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('btn-talk-sos', onOpenSos)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(onOpenSos)}
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fee2e2', marginRight: '6px' }}
            >
              🚨 긴급 호출
            </button>
          )}
          <button
            id="btn-clear-text"
            className={`text-action-btn gazeable ${gazingId === 'btn-clear-text' ? 'gazing' : ''}`}
            onMouseEnter={() => handleMouseEnter('btn-clear-text', () => setTypedText(""))}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleManualClick(() => setTypedText(""))}
          >
            전체 삭제
          </button>
          <button
            id="btn-speak-text"
            className={`text-action-btn primary gazeable ${gazingId === 'btn-speak-text' ? 'gazing' : ''}`}
            onMouseEnter={() => handleMouseEnter('btn-speak-text', speakTypedText)}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleManualClick(speakTypedText)}
          >
            🔊 음성 출력 (TTS)
          </button>
          {onClose && (
            <button
              id="btn-close-keyboard"
              className={`text-action-btn primary gazeable ${gazingId === 'btn-close-keyboard' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('btn-close-keyboard', onClose)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(onClose)}
              style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
            >
              입력 완료(나가기)
            </button>
          )}
        </div>
      </div>

      {/* AI Recommended Phrases Bar */}
      <div className="ai-recommendations-wrapper">
        <div className="ai-label">
          <span className="ai-sparkle">✨</span> AI 자동 추천 문장
        </div>
        <div id="ai-recommends-list" className="ai-recommends-list">
          {recommendations.map((phrase, idx) => (
            <button
              key={idx}
              className={`ai-rec-card gazeable ${gazingId === `ai-rec-${idx}` ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter(`ai-rec-${idx}`, () => handleKeyOrPhraseInput(phrase, true))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => handleKeyOrPhraseInput(phrase, true))}
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>

      {/* Eye Gaze Board Keyboard */}
      <div className="gaze-keyboard-container">
        {/* Quick Words */}
        <div className="keyboard-row quick-words">
          {["배가 ", "목이 ", "자세를 ", "도와 ", "사랑해", "불편해"].map((word, idx) => (
            <button
              key={idx}
              className={`key-btn word-key gazeable ${gazingId === `word-${idx}` ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter(`word-${idx}`, () => handleKeyOrPhraseInput(word))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => handleKeyOrPhraseInput(word))}
            >
              {word.trim()}
            </button>
          ))}
        </div>

        {/* Dynamic Key Rows */}
        <div id="dynamic-keyboard-rows" className="dynamic-keyboard-wrapper">
          {keyboardLayouts[currentLayout].map((row, rowIdx) => (
            <div key={rowIdx} className="keyboard-row">
              {row.map((key, keyIdx) => {
                const id = `key-${rowIdx}-${keyIdx}`;
                let textContent = key;
                let customClass = "";

                if (key === 'TOGGLE_LANG') {
                  textContent = "한/영";
                  customClass = "action-key lang-key";
                } else if (key === 'TOGGLE_NUM') {
                  textContent = currentLayout === 'num' ? "문자" : "123";
                  customClass = "action-key num-key";
                } else if (key === 'SPACE') {
                  textContent = "간격 (Space)";
                  customClass = "action-key space-key";
                } else if (key === 'BACKSPACE') {
                  textContent = "⌫";
                  customClass = "action-key delete-key";
                }

                return (
                  <button
                    key={keyIdx}
                    className={`key-btn gazeable ${customClass} ${gazingId === id ? 'gazing' : ''}`}
                    onMouseEnter={() => handleMouseEnter(id, () => handleKeyOrPhraseInput(key))}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleManualClick(() => handleKeyOrPhraseInput(key))}
                  >
                    {textContent}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="keyboard-overlay">
      <div className="keyboard-panel">
        {layoutContent}
      </div>
    </div>
  );
};
export default Keyboard;
