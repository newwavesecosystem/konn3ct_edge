import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  message: string;
  timestamp: string;
  isPrivate?: boolean;
  fileUrl?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  votedOptionId?: string;
}

export interface Participant {
  userId: string;
  name: string;
  role: string;
  isMobile?: boolean;
  status?: 'active' | 'waiting';
}

export interface Reaction {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  timestamp: number;
}

interface MeetingState {
  chatMessages: ChatMessage[];
  polls: Poll[];
  participants: Participant[];
  waitingRoom: Participant[];
  reactions: Reaction[];
  unreadChatCount: number;
  
  currentUserRole: string | null;
  currentUserId: string | null;

  // Active UI Panes
  activePane: 'none' | 'chat' | 'participants' | 'polls' | 'settings';
  
  // Actions
  setCurrentUser: (userId: string, role: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatHistory: (msgs: ChatMessage[]) => void;
  addReaction: (reaction: Reaction) => void;
  removeReaction: (id: string) => void;
  setPolls: (polls: Poll[]) => void;
  addPoll: (poll: Poll) => void;
  updatePollVote: (pollId: string, optionId: string) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  addWaitingRoomUser: (user: Participant) => void;
  removeWaitingRoomUser: (userId: string) => void;
  setActivePane: (pane: 'none' | 'chat' | 'participants' | 'polls' | 'settings') => void;
  reset: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  chatMessages: [],
  polls: [],
  participants: [],
  waitingRoom: [],
  reactions: [],
  unreadChatCount: 0,
  activePane: 'none',
  currentUserRole: null,
  currentUserId: null,

  setCurrentUser: (userId, role) => set({ currentUserId: userId, currentUserRole: role }),

  addChatMessage: (msg) => set((state) => {
    // Prevent duplicates
    if (state.chatMessages.find(m => m.id === msg.id)) return state;
    
    return {
      chatMessages: [...state.chatMessages, msg],
      unreadChatCount: state.activePane === 'chat' ? state.unreadChatCount : state.unreadChatCount + 1
    };
  }),

  setChatHistory: (msgs) => set({ chatMessages: msgs }),

  addReaction: (reaction) => set((state) => ({
    reactions: [...state.reactions, reaction]
  })),

  removeReaction: (id) => set((state) => ({
    reactions: state.reactions.filter(r => r.id !== id)
  })),

  setPolls: (polls) => set({ polls }),

  addPoll: (poll) => set((state) => {
    if (state.polls.find(p => p.id === poll.id)) return state;
    return { polls: [...state.polls, poll] };
  }),

  updatePollVote: (pollId, optionId) => set((state) => ({
    polls: state.polls.map(p => {
      if (p.id === pollId) {
        return {
          ...p,
          options: p.options.map(opt => 
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          )
        };
      }
      return p;
    })
  })),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) => set((state) => {
    if (state.participants.find(p => p.userId === participant.userId)) return state;
    return { participants: [...state.participants, participant] };
  }),

  removeParticipant: (userId) => set((state) => ({
    participants: state.participants.filter(p => p.userId !== userId)
  })),

  addWaitingRoomUser: (user) => set((state) => {
    if (state.waitingRoom.find(u => u.userId === user.userId)) return state;
    return { waitingRoom: [...state.waitingRoom, user] };
  }),

  removeWaitingRoomUser: (userId) => set((state) => ({
    waitingRoom: state.waitingRoom.filter(u => u.userId !== userId)
  })),

  setActivePane: (pane) => set((state) => ({
    activePane: pane,
    unreadChatCount: pane === 'chat' ? 0 : state.unreadChatCount
  })),

  reset: () => set({
    chatMessages: [],
    polls: [],
    participants: [],
    waitingRoom: [],
    reactions: [],
    unreadChatCount: 0,
    activePane: 'none',
    currentUserRole: null,
    currentUserId: null
  })
}));
