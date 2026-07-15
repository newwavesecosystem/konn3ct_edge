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
  options: { id: string; text: string; votes: number; votedBy?: { userId: string; name: string }[] }[];
  votedOptionId?: string;
  isActive: boolean;
}

export interface Participant {
  userId: string;
  participantId?: string;  // session-level routing ID used by signal server for private messages
  name: string;
  role: string;
  isMobile?: boolean;
  status?: 'active' | 'waiting';
  isHandRaised?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isCameraOn?: boolean;
}

export interface Reaction {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  timestamp: number;
}

export interface CaptionMessage {
  userId: string;
  name: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface MeetingState {
  chatMessages: ChatMessage[];
  polls: Poll[];
  participants: Participant[];
  waitingRoom: Participant[];
  reactions: Reaction[];
  captions: CaptionMessage[];
  unreadChatCount: number;
  
  currentUserRole: string | null;
  currentUserId: string | null;
  isHost: boolean;
  isHandRaisedLocally: boolean;
  isLocalUserSpeaking: boolean;

  // Active UI Panes
  activePane: 'none' | 'chat' | 'participants' | 'polls' | 'settings' | 'streaming' | 'whiteboard' | 'docs' | 'donation';
  theme: 'sage' | 'midnight';
  
  // Actions
  setCurrentUser: (userId: string, role: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatHistory: (msgs: ChatMessage[]) => void;
  addReaction: (reaction: Reaction) => void;
  removeReaction: (id: string) => void;
  setPolls: (polls: Poll[]) => void;
  addPoll: (poll: Poll) => void;
  updatePollVote: (pollId: string, optionId: string, voter?: { userId: string; name: string }) => void;
  endPoll: (pollId: string) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipantHandRaise: (userId: string, isRaised: boolean) => void;
  updateParticipantSpeaking: (userIds: string[]) => void;
  updateParticipantMuteState: (userId: string, isMuted: boolean) => void;
  setIsHandRaisedLocally: (isRaised: boolean) => void;
  addWaitingRoomUser: (user: Participant) => void;
  removeWaitingRoomUser: (userId: string) => void;
  setWaitingRoom: (users: Participant[]) => void;
  setActivePane: (pane: 'none' | 'chat' | 'participants' | 'polls' | 'settings' | 'streaming' | 'whiteboard' | 'docs' | 'donation') => void;
  setTheme: (theme: 'sage' | 'midnight') => void;
  setCaptions: (updater: (curr: CaptionMessage[]) => CaptionMessage[]) => void;
  reset: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  chatMessages: [],
  polls: [],
  participants: [],
  waitingRoom: [],
  reactions: [],
  captions: [],
  unreadChatCount: 0,
  activePane: 'none',
  theme: 'sage',
  currentUserRole: null,
  currentUserId: null,
  isHost: false,
  isHandRaisedLocally: false,
  isLocalUserSpeaking: false,

  setCurrentUser: (userId, role) => set({ 
    currentUserId: userId, 
    currentUserRole: role,
    isHost: role === 'host' || role === 'moderator' || role === 'owner' || role === 'admin' 
  }),
  setTheme: (theme) => set({ theme }),
  setIsHandRaisedLocally: (isRaised) => set({ isHandRaisedLocally: isRaised }),
  setCaptions: (updater) => set((state) => ({ captions: updater(state.captions) })),

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

  updatePollVote: (pollId, optionId, voter) => set((state) => ({
    polls: state.polls.map(p => {
      if (p.id === pollId) {
        return {
          ...p,
          options: p.options.map(opt => 
            opt.id === optionId 
              ? { 
                  ...opt, 
                  votes: opt.votes + 1,
                  votedBy: voter ? [...(opt.votedBy || []), voter] : opt.votedBy
                } 
              : opt
          )
        };
      }
      return p;
    })
  })),

  endPoll: (pollId) => set((state) => ({
    polls: state.polls.map(p =>
      p.id === pollId ? { ...p, isActive: false } : p
    )
  })),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) => set((state) => {
    if (state.participants.find(p => p.userId === participant.userId)) return state;
    return { participants: [...state.participants, participant] };
  }),

  removeParticipant: (userId) => set((state) => ({
    participants: state.participants.filter(p => p.userId !== userId)
  })),

  updateParticipantHandRaise: (userId, isRaised) => set((state) => ({
    participants: state.participants.map(p => 
      p.userId === userId ? { ...p, isHandRaised: isRaised } : p
    )
  })),

  updateParticipantMuteState: (userId, isMuted) => set((state) => ({
    participants: state.participants.map(p =>
      p.userId === userId ? { ...p, isMuted } : p
    )
  })),

  updateParticipantSpeaking: (userIds) => set((state) => ({
    participants: state.participants.map(p => ({
      ...p,
      isSpeaking: userIds.includes(p.userId)
    })),
    isLocalUserSpeaking: state.currentUserId ? userIds.includes(state.currentUserId) : false
  })),

  addWaitingRoomUser: (user) => set((state) => {
    if (state.waitingRoom.find(u => u.userId === user.userId)) return state;
    return { waitingRoom: [...state.waitingRoom, user] };
  }),

  removeWaitingRoomUser: (userId) => set((state) => ({
    waitingRoom: state.waitingRoom.filter(u => u.userId !== userId)
  })),

  setWaitingRoom: (users) => set({ waitingRoom: users }),

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
    theme: 'sage',
    currentUserRole: null,
    currentUserId: null,
    isHost: false,
    isHandRaisedLocally: false,
    isLocalUserSpeaking: false
  })
}));
