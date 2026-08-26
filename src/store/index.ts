import { create } from 'zustand';
import type { Agent, Task, User } from '../types';

interface AppState {
  user: User | null;
  agents: Agent[];
  tasks: Task[];
  setUser: (user: User | null) => void;
  setAgents: (agents: Agent[]) => void;
  setTasks: (tasks: Task[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: number, updates: Partial<Agent>) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  agents: [],
  tasks: [],
  setUser: (user) => set({ user }),
  setAgents: (agents) => set({ agents }),
  setTasks: (tasks) => set({ tasks }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));
