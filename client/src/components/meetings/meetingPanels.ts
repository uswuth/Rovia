import { Users, MessageSquare, MessageCircleQuestion } from 'lucide-react';

export const PANELS = [
  { key: 'people', label: 'People', icon: Users },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'qa', label: 'Q&A', icon: MessageCircleQuestion },
] as const;

export type PanelKey = (typeof PANELS)[number]['key'] | 'polls';
