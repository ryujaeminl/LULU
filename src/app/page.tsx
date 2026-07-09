'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playSound, setMuted, SoundType } from '@/utils/SoundSynth';
import { Message, ChatChannel, Alert, ChannelKey } from '@/types/types';

// Custom Eye Tracking Engine hooks & components
import { useEyeTracking } from '../hooks/useEyeTracking';
import { useCalibration } from '../hooks/useCalibration';
import { useBlinkDetection } from '../hooks/useBlinkDetection';
import Cursor from '../components/Cursor';
import CameraPreview from '../components/CameraPreview';
import Calibration from '../components/Calibration';
import Settings from '../components/Settings';
import Keyboard from '../components/Keyboard';
import Messenger from '../components/Messenger';
import CareHub from '../components/CareHub';
import EyeTracker from '../components/EyeTracker';

// Autocomplete dictionary for AI Recommended phrases
const autocompleteDic: Record<string, string[]> = {
  "배가 ": ["배가 고파요.", "배가 아파요.", "배가 불러요."],
  "목이 ": ["목이 마릅니다. 물 주세요.", "목이 아파요.", "목이 간지러워요."],
  "자세를 ": ["자세를 바꿔주세요.", "자세가 편안합니다.", "자세 변경을 원해요."],
  "도와 ": ["도와주세요! 급합니다.", "도와주셔서 감사합니다."],
  "사랑해": ["사랑해요 엄마.", "사랑해 모두들."],
  "불편해": ["불편해요 몸이.", "호흡기 선이 불편해요."],
  "석션": ["석션이 필요해요.", "호흡기 석션해 주세요."],
  "기관 ": ["기관 흡인(석션)이 필요해요."]
};

const defaultRecommendationsList = [
  "오늘 컨디션 괜찮아.",
  "기관 흡인(석션)이 필요해요.",
  "병원 다녀왔어.",
  "고마워.",
  "물이 필요해요."
];

const getChosung = (str: string): string => {
  const cho = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const index = Math.floor((code - 0xAC00) / 588);
      result += cho[index];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
};

export default function Home() {
  // Eye-Tracking Refs for Video and Canvases
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leftEyeCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightEyeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Hook-based Eye Tracking Engine
  const {
    isInitializing,
    initStatus,
    isReady,
    gazeState,
    intentMode,
    isCalibrating,
    calibrationProgress,
    calibPoint,
    calibrationMode,
    isModelTrained,
    initEngine,
    startCalibration,
    changeIntentMode,
    changeDwellTime,
    dwellTime,
    syncWithPinecone
  } = useEyeTracking(videoRef, canvasRef, leftEyeCanvasRef, rightEyeCanvasRef);

  // Auxiliary UI helpers
  const { getGridStyle } = useCalibration();
  const { blinkThreshold } = useBlinkDetection();

  // App layouts & overlays
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [caregiverDrawerOpen, setCaregiverDrawerOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [showCamera, setShowCamera] = useState<boolean>(true);

  // Sound toggle
  const [muted, setMutedState] = useState<boolean>(false);

  // Patient Input states
  const [typedText, setTypedText] = useState<string>("");
  const [currentLayout, setCurrentLayout] = useState<'kor' | 'eng' | 'num'>('kor');
  const [activePatientTab, setActivePatientTab] = useState<'talk' | 'sns'>('talk');
  const [isTalkKeyboardOpen, setIsTalkKeyboardOpen] = useState<boolean>(false);
  const [isSnsKeyboardOpen, setIsSnsKeyboardOpen] = useState<boolean>(false);
  const [isSosPopupOpen, setIsSosPopupOpen] = useState<boolean>(false);

  const handleTabChange = useCallback((tab: 'talk' | 'sns') => {
    setActivePatientTab(tab);
    setIsTalkKeyboardOpen(false);
    setIsSnsKeyboardOpen(false);
    setIsSosPopupOpen(false);
  }, []);

  // Caregiver states
  const [postureTimerMinutes, setPostureTimerMinutes] = useState<number>(135);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sleepAlertsEnabled, setSleepAlertsEnabled] = useState<boolean>(true);

  // Dynamic AI Suggestions
  const [defaultRecommendations, setDefaultRecommendations] = useState<string[]>(defaultRecommendationsList);

  // Chat History
  const [currentChannel, setCurrentChannel] = useState<ChannelKey>("kakao");
  const [chatHistory, setChatHistory] = useState<Record<ChannelKey, ChatChannel>>({
    kakao: {
      avatar: "👩",
      name: "엄마 (보호자)",
      messages: [
        { sender: "received", content: "수민아, 필요한 거 있으면 언제든 말해줘. 밥 먹을 시간 다 돼가네.", time: "오후 4:20" }
      ],
      replies: [
        "바로 방으로 갈게! 필요한 거 챙겨갈 테니 기다려.",
        "오케이 확인했어. 호흡기 체크해 볼까?",
        "사랑해 우리 아들, 힘내자!",
        "자세 바꿔줄까? 지금 갈게."
      ]
    },
    insta: {
      avatar: "👨‍💻",
      name: "친구 민우",
      messages: [
        { sender: "received", content: "야 수민아! 몸은 좀 어때? 날씨 좀 선선해지면 면회 갈게!", time: "오후 2:15" },
        { sender: "sent", content: "고마워 친구야", time: "오후 2:20" },
        { sender: "received", content: "아냐 힘내라 임마! 필요한 책이나 보고싶은 영상 있으면 말해 사갈게 ㅎㅎ", time: "오후 2:22" }
      ],
      replies: [
        "오케이! 조만간 병문안 갈 때 들고 갈게.",
        "힘내자 친구야! 넌 할 수 있어.",
        "답장해 줘서 고마워. 언제든 메시지 보내줘!",
        "주말에 다른 친구들이랑 같이 들를게!"
      ]
    },
    sms: {
      avatar: "🩺",
      name: "김윤아 주치의",
      messages: [
        { sender: "received", content: "김수민 환자님, 오늘 오후 호흡 센서 수치는 아주 정상입니다. 약은 거르지 말고 잘 챙겨 드세요.", time: "오전 10:30" }
      ],
      replies: [
        "네, 확인했습니다. 증상이 있으면 즉시 호출해 주세요.",
        "처방한 약 복용 시간 잘 준수해 주셔서 감사합니다.",
        "자세 변경을 주기적으로 잘 실시하고 계시네요. 훌륭합니다."
      ]
    }
  });

  const [mouseGazingId, setMouseGazingId] = useState<string | null>(null);
  const gazingId = mouseGazingId || (isReady && !isCalibrating ? gazeState.gazedElementId : null);
  const gazeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatMessagesBoxRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat box on history update
  useEffect(() => {
    if (chatMessagesBoxRef.current) {
      chatMessagesBoxRef.current.scrollTop = chatMessagesBoxRef.current.scrollHeight;
    }
  }, [chatHistory, currentChannel, activePatientTab]);

  // Simulation: Posture elapsed time incrementor (runs faster in prototype)
  useEffect(() => {
    const interval = setInterval(() => {
      setPostureTimerMinutes(prev => prev + 1);
    }, 10000); // 1 minute simulation every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleToggleSound = () => {
    const nextMuted = !muted;
    setMutedState(nextMuted);
    setMuted(nextMuted);
  };

  const closeAllPanels = () => {
    setSidebarOpen(false);
    setCaregiverDrawerOpen(false);
    setSettingsModalOpen(false);
  };

  // Dispatch live alerts to caregiver
  const dispatchCaregiverAlert = useCallback((priority: 'emergency' | 'important' | 'regular', message: string) => {
    playSound(priority);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const alertId = "alert-" + Date.now() + Math.random().toString(36).substr(2, 4);

    const alertObj: Alert = {
      id: alertId,
      priority,
      message,
      time: timeStr,
      status: 'active'
    };

    setAlerts(prev => [alertObj, ...prev]);
  }, []);

  // Acknowledge caregiver alert
  const resolveAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    playSound('click');
  }, []);

  // Dwell timer event controllers
  const handleMouseEnter = useCallback((id: string, action: () => void) => {
    if (gazeTimerRef.current) clearTimeout(gazeTimerRef.current);
    setMouseGazingId(id);
    gazeTimerRef.current = setTimeout(() => {
      action();
      setMouseGazingId(null);
    }, dwellTime);
  }, [dwellTime]);

  const handleMouseLeave = useCallback(() => {
    if (gazeTimerRef.current) clearTimeout(gazeTimerRef.current);
    setMouseGazingId(null);
  }, []);

  const handleManualClick = useCallback((action: () => void) => {
    if (gazeTimerRef.current) clearTimeout(gazeTimerRef.current);
    setMouseGazingId(null);
    action();
  }, []);

  // Text compositions input handlers
  const handleKeyOrPhraseInput = useCallback((val: string, isPhrase = false) => {
    playSound('click');
    if (isPhrase) {
      setTypedText(val);
      return;
    }

    if (val === "BACKSPACE") {
      setTypedText(prev => prev.length > 0 ? prev.substring(0, prev.length - 1) : "");
    } else if (val === "SPACE") {
      setTypedText(prev => prev + " ");
    } else {
      setTypedText(prev => prev + val);
    }
  }, []);

  // Speech TTS Output
  const speakTypedText = useCallback(() => {
    if (!typedText) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(typedText);
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);
    } else {
      alert(`🔉 음성 출력(TTS): "${typedText}"`);
    }
  }, [typedText]);

  const handleSubmitText = useCallback(() => {
    if (!typedText) return;
    
    // Speak via TTS
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(typedText);
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);
    }
    
    // Send regular alert notification to caregiver hub
    dispatchCaregiverAlert('regular', `환자 메시지: ${typedText}`);
    
    // Clear input
    setTypedText("");
  }, [typedText, dispatchCaregiverAlert]);

  // Send Messenger Chat Message
  const sendSNSMessage = useCallback(() => {
    if (!typedText) return;
    playSound('click');

    const now = new Date();
    const timeStr = `${now.getHours() >= 12 ? '오후' : '오전'} ${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;

    setChatHistory(prev => {
      const channelData = prev[currentChannel];
      const updatedMessages = [
        ...channelData.messages,
        { sender: 'sent' as const, content: typedText, time: timeStr }
      ];

      return {
        ...prev,
        [currentChannel]: {
          ...channelData,
          messages: updatedMessages
        }
      };
    });

    const sentContent = typedText;
    setTypedText("");

    // Bubble notification chime
    playSound('regular');

    // Simulate caregiver automatic reply
    setTimeout(() => {
      setChatHistory(prev => {
        const channelData = prev[currentChannel];
        const randomReply = channelData.replies[Math.floor(Math.random() * channelData.replies.length)];
        const updatedMessages = [
          ...channelData.messages,
          { sender: 'received' as const, content: randomReply, time: timeStr }
        ];

        return {
          ...prev,
          [currentChannel]: {
            ...channelData,
            messages: updatedMessages
          }
        };
      });
      playSound('regular');
    }, 2000);
  }, [typedText, currentChannel]);

  // Dynamic recommendations computed on render
  const getDynamicRecommendations = useCallback(() => {
    if (!typedText) return defaultRecommendations;

    const query = typedText.trim();
    if (!query) return defaultRecommendations;

    // 1. Check direct prefix/ends-with match in autocompleteDic
    let matches: string[] = [];
    for (const prefix in autocompleteDic) {
      if (typedText.endsWith(prefix) || typedText === prefix.trim()) {
        matches = [...autocompleteDic[prefix]];
        break;
      }
    }

    // 2. Initial Consonant (Chosung) or Substring match
    const queryChosung = getChosung(query).replace(/\s/g, "");
    
    // Gather all recommendations
    const allCandidates = Array.from(new Set([
      ...defaultRecommendations,
      ...Object.values(autocompleteDic).flat(),
      "식사를 하고 싶어요.",
      "물을 드릴까요?",
      "목이 마릅니다. 물 주세요."
    ]));

    const chosungMatches = allCandidates.filter(phrase => {
      const phraseChosung = getChosung(phrase).replace(/\s/g, "");
      return phraseChosung.startsWith(queryChosung) || phrase.replace(/\s/g, "").includes(query.replace(/\s/g, ""));
    });

    const merged = Array.from(new Set([...matches, ...chosungMatches]));

    return merged.length > 0 ? merged.slice(0, 6) : defaultRecommendations;
  }, [typedText, defaultRecommendations]);

  // Forced posture sensor mock trigger
  const runSimPostureChange = useCallback(() => {
    setPostureTimerMinutes(145); // 2h 25m
    dispatchCaregiverAlert('important', '자세 변경 주기 초과 경고');
    
    // Suggest posture help items at the top of recommendations list
    setDefaultRecommendations(["자세를 바꿔주세요.", "몸이 찌푸둥해요.", "기관 흡인(석션)이 필요해요.", "고마워.", "물이 필요해요."]);
  }, [dispatchCaregiverAlert]);

  // Meal schedule mock trigger
  const runSimMealTime = useCallback(() => {
    setDefaultRecommendations(["식사를 하고 싶어요.", "물을 드릴까요?", "목이 마릅니다. 물 주세요.", "고마워.", "오늘 컨디션 괜찮아."]);
  }, []);

  const handleSidebarNav = useCallback((val: string) => {
    if (val === "MENU_GO_TALK") {
      closeAllPanels();
      handleTabChange("talk");
    } else if (val === "MENU_OPEN_CAREGIVER") {
      setSidebarOpen(false);
      setSettingsModalOpen(false);
      setCaregiverDrawerOpen(true);
    } else if (val === "MENU_OPEN_SETTINGS") {
      setSidebarOpen(false);
      setCaregiverDrawerOpen(false);
      setSettingsModalOpen(true);
    }
  }, [handleTabChange]);

  const isCamVisible = showCamera || gazeState.errorState.noFaceDetected;

  return (
    <EyeTracker
      isReady={isReady}
      isInitializing={isInitializing}
      initStatus={initStatus}
      initEngine={initEngine}
    >
      <div 
        style={{ '--dwell-time-duration': `${dwellTime / 1000}s` } as React.CSSProperties} 
        className={`contents-wrapper mode-${intentMode}`}
      >
        {/* Gaze Cursor */}
        <Cursor 
          x={gazeState.smoothedX} 
          y={gazeState.smoothedY} 
          visible={isReady && isModelTrained && !isCalibrating} 
        />

        {/* Calibration Overlay */}
        <Calibration 
          isCalibrating={isCalibrating} 
          progress={calibrationProgress} 
          calibPoint={calibPoint} 
          calibrationMode={calibrationMode} 
        />

        {/* Background Glow Elements */}
        <div className="glow-bg glow-1"></div>
        <div className="glow-bg glow-2"></div>

        {/* Sliding Sidebar Menu */}
        <div id="sidebar-menu" className={`menu-drawer ${sidebarOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <div className="sidebar-logo">
              <span className="logo-symbol">L</span>
              <h3>LuLu 메뉴</h3>
            </div>
            <button
              id="menu-close-btn"
              className={`gazeable icon-btn close-btn ${gazingId === 'menu-close-btn' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('menu-close-btn', closeAllPanels)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(closeAllPanels)}
            >
              ✕
            </button>
          </div>
          <div className="drawer-content">
            <button
              className={`menu-item gazeable ${activePatientTab === 'talk' ? 'active' : ''} ${gazingId === 'menu-item-talk' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('menu-item-talk', () => handleSidebarNav('MENU_GO_TALK'))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => handleSidebarNav('MENU_GO_TALK'))}
            >
              💬 환자 소통 화면
            </button>
            <button
              className={`menu-item gazeable ${gazingId === 'menu-item-caregiver' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('menu-item-caregiver', () => handleSidebarNav('MENU_OPEN_CAREGIVER'))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => handleSidebarNav('MENU_OPEN_CAREGIVER'))}
            >
              🛌 보호자 모니터링 허브
            </button>
            <button
              className={`menu-item gazeable ${gazingId === 'menu-item-settings' ? 'gazing' : ''}`}
              onMouseEnter={() => handleMouseEnter('menu-item-settings', () => handleSidebarNav('MENU_OPEN_SETTINGS'))}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleManualClick(() => handleSidebarNav('MENU_OPEN_SETTINGS'))}
            >
              ⚙️ 개인 설정
            </button>
            
            <div className="menu-divider"></div>
            
            {/* Collapsible Simulator Controls inside Sidebar */}
            <div className="sidebar-section">
              <h4>🛠️ 테스트 시뮬레이터</h4>
              <div className="sidebar-sim-controls">
                <button
                  id="btn-sidebar-sim-posture"
                  className={`sim-btn gazeable ${gazingId === 'btn-sidebar-sim-posture' ? 'gazing' : ''}`}
                  onMouseEnter={() => handleMouseEnter('btn-sidebar-sim-posture', runSimPostureChange)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleManualClick(runSimPostureChange)}
                >
                  🔄 2시간 자세 초과 유도
                </button>
                <button
                  id="btn-sidebar-sim-meal"
                  className={`sim-btn gazeable ${gazingId === 'btn-sidebar-sim-meal' ? 'gazing' : ''}`}
                  onMouseEnter={() => handleMouseEnter('btn-sidebar-sim-meal', runSimMealTime)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleManualClick(runSimMealTime)}
                >
                  🍱 식사 시간 적용
                </button>
              </div>
            </div>
            
            <div className="menu-divider"></div>
            
            <div className="acronym-box">
              <h4>Listen, Understand, Link, Uplift</h4>
              <p>환자의 마음을 듣고, 이해하고, 연결하고, 위로하는 LuLu 의사소통 서비스</p>
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        <Settings 
          isOpen={settingsModalOpen} 
          onClose={closeAllPanels} 
          intentMode={intentMode} 
          changeIntentMode={changeIntentMode} 
          dwellTime={dwellTime} 
          changeDwellTime={changeDwellTime} 
          startCalibration={startCalibration} 
          isModelTrained={isModelTrained} 
          syncWithPinecone={syncWithPinecone}
        />

        {/* Sliding Caregiver Panel Drawer */}
        <CareHub 
          postureTimerMinutes={postureTimerMinutes} 
          setPostureTimerMinutes={setPostureTimerMinutes} 
          alerts={alerts} 
          resolveAlert={resolveAlert} 
          sleepAlertsEnabled={sleepAlertsEnabled} 
          setSleepAlertsEnabled={setSleepAlertsEnabled} 
          triggerSound={playSound} 
          gazingId={gazingId} 
          handleMouseEnter={handleMouseEnter} 
          handleMouseLeave={handleMouseLeave} 
          handleManualClick={handleManualClick} 
          isOpen={caregiverDrawerOpen} 
          onClose={closeAllPanels} 
        />

        {/* Overlay Backdrop for drawers and modals */}
        <div
          id="overlay-backdrop"
          className={`backdrop-overlay ${(sidebarOpen || caregiverDrawerOpen || settingsModalOpen) ? 'show' : ''}`}
          onClick={closeAllPanels}
        ></div>
        {/* Main Grid Workspace */}
        <main className="workspace-grid">
          {/* 1. Patient Screen (환자용 태블릿 모드) */}
          <section className="device-column patient-column">
            <div className="device-header">
              <div className="device-pill">LuLu Screen (소통 태블릿)</div>
              <div className="device-status">
                <span className={`pulse-indicator ${postureTimerMinutes >= 120 ? 'red pulse-active' : 'green'}`}></span>
                <span id="patient-status-text">
                  {postureTimerMinutes >= 120 ? "경고: 자세를 바꿀 시간입니다" : "시선 센서 연결됨"}
                </span>
              </div>
            </div>

            <div className="device-frame glass-panel">
              
              {/* Patient App Header */}
              <div className="patient-app-header">
                <div className="patient-profile">
                  {/* Hamburger Menu Button */}
                  <button
                    id="menu-toggle-btn"
                    className={`menu-hamburger-btn gazeable ${gazingId === 'menu-toggle-btn' ? 'gazing' : ''}`}
                    onMouseEnter={() => handleMouseEnter('menu-toggle-btn', () => setSidebarOpen(true))}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleManualClick(() => setSidebarOpen(true))}
                  >
                    <span className="hamburger-line"></span>
                    <span className="hamburger-line"></span>
                    <span className="hamburger-line"></span>
                  </button>
                  <div className="patient-avatar">👩‍⚕️</div>
                  <div>
                    <h3>김수민 환자</h3>
                    <p>기기 모드: 시선 추적 입력 활성</p>
                  </div>
                </div>
                <div className="active-mode-selector">
                  <button
                    id="mode-btn-talk"
                    className={`mode-tab gazeable ${activePatientTab === 'talk' ? 'active' : ''} ${gazingId === 'mode-btn-talk' ? 'gazing' : ''}`}
                    onMouseEnter={() => handleMouseEnter('mode-btn-talk', () => handleTabChange('talk'))}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleManualClick(() => handleTabChange('talk'))}
                  >
                    💬 일반 대화
                  </button>
                  <button
                    id="mode-btn-sns"
                    className={`mode-tab gazeable ${activePatientTab === 'sns' ? 'active' : ''} ${gazingId === 'mode-btn-sns' ? 'gazing' : ''}`}
                    onMouseEnter={() => handleMouseEnter('mode-btn-sns', () => handleTabChange('sns'))}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleManualClick(() => handleTabChange('sns'))}
                  >
                    📱 SNS 메신저
                  </button>
                </div>
              </div>

              {/* Mode 1: General Talk & Input */}
              {activePatientTab === 'talk' && (
                isTalkKeyboardOpen ? (
                  <Keyboard 
                    typedText={typedText} 
                    setTypedText={setTypedText} 
                    speakTypedText={speakTypedText} 
                    onClose={() => setIsTalkKeyboardOpen(false)}
                    onOpenSos={() => setIsSosPopupOpen(true)}
                    currentLayout={currentLayout} 
                    setCurrentLayout={setCurrentLayout} 
                    gazingId={gazingId} 
                    handleMouseEnter={handleMouseEnter} 
                    handleMouseLeave={handleMouseLeave} 
                    handleManualClick={handleManualClick} 
                    recommendations={getDynamicRecommendations()} 
                  />
                ) : (
                  <div className="patient-view-content active" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                    {/* Text Display Board */}
                    <div className="text-display-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div id="typed-text-preview" className={typedText.length === 0 ? "placeholder" : ""} style={{ fontSize: '2rem', textAlign: 'center' }}>
                        <span className="layout-badge" style={{ color: 'var(--color-ai)', fontWeight: 'bold', marginRight: '6px', fontSize: '1.2rem' }}>
                          {currentLayout === 'kor' ? '[한글 자판]' : currentLayout === 'eng' ? '[영문 자판]' : '[숫자 자판]'}
                        </span>
                        {typedText.length === 0 ? "키보드 버튼을 눌러 문장을 입력하세요..." : typedText}
                      </div>
                    </div>

                    {/* AI Recommended Phrases Bar */}
                    <div className="ai-recommendations-wrapper">
                      <div className="ai-label" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>
                        <span className="ai-sparkle">✨</span> AI 자동 추천 문장
                      </div>
                      <div id="ai-recommends-list" className="ai-recommends-list">
                        {getDynamicRecommendations().map((phrase, idx) => (
                          <button
                            key={idx}
                            className={`ai-rec-card gazeable ${gazingId === `ai-rec-${idx}` ? 'gazing' : ''}`}
                            onMouseEnter={() => handleMouseEnter(`ai-rec-${idx}`, () => setTypedText(phrase))}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => handleManualClick(() => setTypedText(phrase))}
                          >
                            {phrase}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Actions bar at bottom */}
                    <div className="chat-input-bar" style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr auto', gap: '10px' }}>
                      <button
                        id="btn-talk-sos"
                        className={`text-action-btn gazeable ${gazingId === 'btn-talk-sos' ? 'gazing' : ''}`}
                        onMouseEnter={() => handleMouseEnter('btn-talk-sos', () => setIsSosPopupOpen(true))}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleManualClick(() => setIsSosPopupOpen(true))}
                        style={{ padding: '12px 18px', fontSize: '1.2rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fee2e2' }}
                      >
                        🚨 긴급 호출
                      </button>
                      <button
                        id="btn-talk-clear"
                        className={`text-action-btn gazeable ${gazingId === 'btn-talk-clear' ? 'gazing' : ''}`}
                        onMouseEnter={() => handleMouseEnter('btn-talk-clear', () => setTypedText(""))}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleManualClick(() => setTypedText(""))}
                        style={{ padding: '12px 18px', fontSize: '1.2rem' }}
                      >
                        전체 삭제
                      </button>
                      <button
                        id="btn-talk-keyboard"
                        className={`text-action-btn primary gazeable ${gazingId === 'btn-talk-keyboard' ? 'gazing' : ''}`}
                        onMouseEnter={() => handleMouseEnter('btn-talk-keyboard', () => setIsTalkKeyboardOpen(true))}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleManualClick(() => setIsTalkKeyboardOpen(true))}
                        style={{ padding: '12px 18px', fontSize: '1.2rem' }}
                      >
                        ⌨️ 키보드
                      </button>
                      <div style={{ flex: 1 }}></div>
                      <button
                        id="btn-talk-speak"
                        className={`text-action-btn primary gazeable ${gazingId === 'btn-talk-speak' ? 'gazing' : ''}`}
                        onMouseEnter={() => handleMouseEnter('btn-talk-speak', speakTypedText)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleManualClick(speakTypedText)}
                        style={{ padding: '12px 18px', fontSize: '1.2rem', backgroundColor: 'var(--color-regular)', borderColor: 'var(--color-regular)' }}
                      >
                        🔊 음성 출력 (TTS)
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Mode 2: SNS Messenger Simulator */}
              {activePatientTab === 'sns' && (
                isSnsKeyboardOpen ? (
                  <Keyboard 
                    typedText={typedText} 
                    setTypedText={setTypedText} 
                    speakTypedText={speakTypedText} 
                    onClose={() => setIsSnsKeyboardOpen(false)}
                    currentLayout={currentLayout} 
                    setCurrentLayout={setCurrentLayout} 
                    gazingId={gazingId} 
                    handleMouseEnter={handleMouseEnter} 
                    handleMouseLeave={handleMouseLeave} 
                    handleManualClick={handleManualClick} 
                    recommendations={getDynamicRecommendations()} 
                  />
                ) : (
                  <Messenger 
                    typedText={typedText} 
                    setTypedText={setTypedText}
                    currentChannel={currentChannel} 
                    setCurrentChannel={setCurrentChannel} 
                    chatHistory={chatHistory} 
                    sendSNSMessage={sendSNSMessage} 
                    chatMessagesBoxRef={chatMessagesBoxRef} 
                    gazingId={gazingId} 
                    handleMouseEnter={handleMouseEnter} 
                    handleMouseLeave={handleMouseLeave} 
                    handleManualClick={handleManualClick} 
                    onOpenKeyboard={() => setIsSnsKeyboardOpen(true)}
                    onOpenSos={() => setIsSosPopupOpen(true)}
                  />
                )
              )}



            </div>
          </section>
        </main>

        {/* Real-time Video Preview & Analytics overlay feed */}
        <CameraPreview 
          videoRef={videoRef} 
          canvasRef={canvasRef} 
          leftEyeCanvasRef={leftEyeCanvasRef} 
          rightEyeCanvasRef={rightEyeCanvasRef} 
          showCamera={isCamVisible} 
          setShowCamera={setShowCamera} 
          errorState={gazeState.errorState} 
          fps={gazeState.fps} 
          gazingId={gazingId}
          handleMouseEnter={handleMouseEnter}
          handleMouseLeave={handleMouseLeave}
          handleManualClick={handleManualClick}
        />

        {/* SOS Emergency Call Popup Overlay */}
        {isSosPopupOpen && (
          <div className="keyboard-overlay" style={{ zIndex: 8600 }}>
            <div className="sos-panel">
              <div className="quick-call-board" style={{ borderTop: 'none', padding: '0', background: 'transparent' }}>
                <h2 style={{ fontSize: '2.2rem', fontWeight: '800', textAlign: 'center', marginBottom: '30px', color: 'white' }}>
                  🚨 보호자 호출 시스템 (원클릭 긴급 상황 전송)
                </h2>
                <div className="call-buttons-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
                  {/* [응급] */}
                  <div className="call-col red-col" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="col-title" style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fca5a5', fontWeight: 'bold', textAlign: 'center' }}>[응급 호출]</div>
                    {[
                      { text: "숨쉬기 힘듦 🫁", msg: "숨쉬기 힘들어요" },
                      { text: "호흡기 점검 🔌", msg: "호흡기 점검 필요" },
                      { text: "기관 흡인(석션) 🩺", msg: "기관 흡인(석션)이 필요해요" }
                    ].map((item, idx) => {
                      const id = `popup-call-emergency-${idx}`;
                      return (
                        <button
                          key={idx}
                          className={`call-btn emergency-btn gazeable ${gazingId === id ? 'gazing' : ''}`}
                          onMouseEnter={() => handleMouseEnter(id, () => {
                            dispatchCaregiverAlert('emergency', item.msg);
                            setIsSosPopupOpen(false);
                          })}
                          onMouseLeave={handleMouseLeave}
                          onClick={() => handleManualClick(() => {
                            dispatchCaregiverAlert('emergency', item.msg);
                            setIsSosPopupOpen(false);
                          })}
                          style={{ padding: '20px 10px', fontSize: '1.3rem', borderRadius: '12px', minHeight: '80px' }}
                        >
                          {item.text}
                        </button>
                      );
                    })}
                  </div>
                  {/* [중요] */}
                  <div className="call-col yellow-col" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="col-title" style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fde047', fontWeight: 'bold', textAlign: 'center' }}>[중요 호출]</div>
                    {[
                      { text: "자세 변경 🛌", msg: "자세를 바꿔주세요" },
                      { text: "통증 호소 ⚡", msg: "몸에 통증이 있어요" },
                      { text: "불편 감지 ⚠️", msg: "몸이 너무 불편해요" }
                    ].map((item, idx) => {
                      const id = `popup-call-important-${idx}`;
                      return (
                        <button
                          key={idx}
                          className={`call-btn important-btn gazeable ${gazingId === id ? 'gazing' : ''}`}
                          onMouseEnter={() => handleMouseEnter(id, () => {
                            dispatchCaregiverAlert('important', item.msg);
                            setIsSosPopupOpen(false);
                          })}
                          onMouseLeave={handleMouseLeave}
                          onClick={() => handleManualClick(() => {
                            dispatchCaregiverAlert('important', item.msg);
                            setIsSosPopupOpen(false);
                          })}
                          style={{ padding: '20px 10px', fontSize: '1.3rem', borderRadius: '12px', minHeight: '80px' }}
                        >
                          {item.text}
                        </button>
                      );
                    })}
                  </div>
                  {/* [일반] */}
                  <div className="call-col blue-col" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="col-title" style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold', textAlign: 'center' }}>[일반 요청]</div>
                    {[
                      { text: "물 요청 💧", msg: "물을 마시고 싶어요" },
                      { text: "화장실 🚽", msg: "화장실 가고 싶어요" },
                      { text: "대화 요청 💬", msg: "대화 나누고 싶어요" }
                    ].map((item, idx) => {
                      const id = `popup-call-regular-${idx}`;
                      return (
                        <button
                          key={idx}
                          className={`call-btn regular-btn gazeable ${gazingId === id ? 'gazing' : ''}`}
                          onMouseEnter={() => handleMouseEnter(id, () => {
                            dispatchCaregiverAlert('regular', item.msg);
                            setIsSosPopupOpen(false);
                          })}
                          onMouseLeave={handleMouseLeave}
                          onClick={() => handleManualClick(() => {
                            dispatchCaregiverAlert('regular', item.msg);
                            setIsSosPopupOpen(false);
                          })}
                          style={{ padding: '20px 10px', fontSize: '1.3rem', borderRadius: '12px', minHeight: '80px' }}
                        >
                          {item.text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Close Button */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    id="btn-close-sos"
                    className={`text-action-btn primary gazeable ${gazingId === 'btn-close-sos' ? 'gazing' : ''}`}
                    onMouseEnter={() => handleMouseEnter('btn-close-sos', () => setIsSosPopupOpen(false))}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleManualClick(() => setIsSosPopupOpen(false))}
                    style={{ padding: '16px 40px', fontSize: '1.4rem', backgroundColor: '#ef4444', borderColor: '#ef4444', borderRadius: '12px', color: 'white' }}
                  >
                    호출 취소 및 닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visual Gaze Pointer Dot */}
        {isReady && isModelTrained && !isCalibrating && (
          <div 
            className="gaze-pointer-dot"
            style={{
              left: `${gazeState.smoothedX}px`,
              top: `${gazeState.smoothedY}px`
            }}
          />
        )}
      </div>
    </EyeTracker>
  );
}
