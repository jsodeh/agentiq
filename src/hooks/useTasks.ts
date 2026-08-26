import { useEffect } from 'react';
import { useStore } from '../store';
import type { Task } from '../types';

export function useTasks(agentId?: number) {
  const { tasks, setTasks, addTask, updateTask } = useStore();

  useEffect(() => {
    loadTasks();
  }, [agentId]);

  const loadTasks = async () => {
    // TODO: Load tasks from database
    console.log('Loading tasks for agent:', agentId);
  };

  const createTask = async (agentId: number, description: string) => {
    // TODO: Create task in database
    const newTask: Task = {
      id: Date.now(),
      agent_id: agentId,
      description,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    addTask(newTask);
    return newTask;
  };

  const completeTask = async (taskId: number, result: string) => {
    updateTask(taskId, {
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    });
  };

  const failTask = async (taskId: number, error: string) => {
    updateTask(taskId, {
      status: 'failed',
      result: error,
      completed_at: new Date().toISOString(),
    });
  };

  const filteredTasks = agentId
    ? tasks.filter(t => t.agent_id === agentId)
    : tasks;

  return {
    tasks: filteredTasks,
    createTask,
    completeTask,
    failTask,
    loadTasks,
  };
}
