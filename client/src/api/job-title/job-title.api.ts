import client from '../client';

export interface JobTitle {
  id: string;
  title: string;
  organizationId: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export const getJobTitles = () =>
  client.get<{ data: JobTitle[] }>('/job-titles');

export const createJobTitle = (title: string) =>
  client.post<{ data: JobTitle }>('/job-titles', { title });

export const updateJobTitle = (id: string, title: string) =>
  client.put<{ data: JobTitle }>(`/job-titles/${id}`, { title });

export const deleteJobTitle = (id: string) =>
  client.delete(`/job-titles/${id}`);

export const assignJobTitle = (userId: string, title: string) =>
  client.post('/job-titles/assign', { userId, title });
