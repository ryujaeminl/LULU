import React from 'react';

export type ChannelKey = 'kakao' | 'insta' | 'sms';

export interface ChatMessage {
  sender: 'sent' | 'received';
  content: string;
  time: string;
}

export interface ChatHistory {
  name: string;
  avatar: string;
  messages: ChatMessage[];
  replies: string[];
}

interface MessengerProps {
  typedText: string;
  setTypedText: (text: string) => void;
  currentChannel: ChannelKey;
  setCurrentChannel: (chan: ChannelKey) => void;
  chatHistory: Record<ChannelKey, ChatHistory>;
  sendSNSMessage: () => void;
  chatMessagesBoxRef: React.RefObject<HTMLDivElement | null>;
  gazingId: string | null;
  handleMouseEnter: (id: string, action: () => void) => void;
  handleMouseLeave: () => void;
  handleManualClick: (action: () => void) => void;
  onOpenKeyboard: () => void;
  onOpenSos: () => void;
}

export const Messenger: React.FC<MessengerProps> = ({
  typedText,
  setTypedText,
  currentChannel,
  setCurrentChannel,
  chatHistory,
  sendSNSMessage,
  chatMessagesBoxRef,
  gazingId,
  handleMouseEnter,
  handleMouseLeave,
  handleManualClick,
  onOpenKeyboard,
  onOpenSos
}) => {
  return (
    <div className="patient-view-content active">
      <div className="sns-messenger-grid">
        {/* Channels Sidebar */}
        <div className="sns-channels">
          {(['kakao', 'insta', 'sms'] as ChannelKey[]).map(chan => (
            <button
              key={chan}
              className={`sns-channel-tab gazeable ${currentChannel === chan ? 'active' : ''} ${gazingId === `chan-${chan}` ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter(`chan-${chan}`, () => setCurrentChannel(chan))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => setCurrentChannel(chan))}
            >
              <span className={`channel-icon ${chan}`}>
                {chan === 'kakao' && "💬"}
                {chan === 'insta' && "📸"}
                {chan === 'sms' && "✉️"}
              </span>
              {chan === 'kakao' && "Kakaotalk"}
              {chan === 'insta' && "Instagram"}
              {chan === 'sms' && "SMS 문자"}
            </button>
          ))}
        </div>

        {/* Chat Client */}
        <div className="sns-chat-window">
          <div className="chat-header">
            <span style={{ marginRight: '8px' }}>{chatHistory[currentChannel].avatar}</span>
            <span>{chatHistory[currentChannel].name}</span>
          </div>
          <div id="chat-messages-box" className="chat-messages" ref={chatMessagesBoxRef}>
            {chatHistory[currentChannel].messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <div className="msg-content">{msg.content}</div>
                <div className="msg-time">{msg.time}</div>
              </div>
            ))}
          </div>
          <div className="chat-input-bar">
            <button
              id="btn-sns-sos"
              className={`text-action-btn gazeable ${gazingId === 'btn-sns-sos' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('btn-sns-sos', onOpenSos)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(onOpenSos)}
              style={{ padding: '8px 12px', fontSize: '1rem', whiteSpace: 'nowrap', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fee2e2' }}
            >
              🚨 긴급 호출
            </button>
            <button
              id="btn-sns-clear"
              className={`text-action-btn gazeable ${gazingId === 'btn-sns-clear' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('btn-sns-clear', () => setTypedText(""))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => setTypedText(""))}
              style={{ padding: '8px 12px', fontSize: '1rem', whiteSpace: 'nowrap' }}
            >
              전체 삭제
            </button>
            <button
              id="btn-sns-keyboard"
              className={`text-action-btn primary gazeable ${gazingId === 'btn-sns-keyboard' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('btn-sns-keyboard', onOpenKeyboard)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(onOpenKeyboard)}
              style={{ padding: '8px 12px', fontSize: '1rem', whiteSpace: 'nowrap' }}
            >
              ⌨️ 키보드
            </button>
            <div id="sns-input-preview" className={`sns-input-field ${typedText.length === 0 ? "placeholder" : ""}`}>
              {typedText.length === 0 ? "키보드 버튼을 눌러 메시지를 입력하세요..." : typedText}
            </div>
            <button
              id="btn-sns-send"
              className={`gazeable primary-btn ${gazingId === 'btn-sns-send' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('btn-sns-send', sendSNSMessage)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(sendSNSMessage)}
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Messenger;
