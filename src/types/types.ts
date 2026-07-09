export interface Message {
  sender: 'sent' | 'received';
  content: string;
  time: string;
}

export interface ChatChannel {
  avatar: string;
  name: string;
  messages: Message[];
  replies: string[];
}

export type ChannelKey = 'kakao' | 'insta' | 'sms';

export interface Alert {
  id: string;
  priority: 'emergency' | 'important' | 'regular';
  message: string;
  time: string;
  status: 'active' | 'resolved';
}
