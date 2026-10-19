import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'IntellMeet';

const routeMeta: Record<string, { title: string; description: string }> = {
  '/login': {
    title: 'Sign In',
    description: 'Sign in to IntellMeet to access your meetings, projects and team workspace.',
  },
  '/signup': {
    title: 'Create Account',
    description: 'Create your IntellMeet account and start running AI-powered meetings.',
  },
  '/dashboard': {
    title: 'Dashboard',
    description: 'Your IntellMeet dashboard — meetings, projects and activity at a glance.',
  },
  '/projects': {
    title: 'Projects',
    description: 'Manage your projects, track progress and collaborate with your team.',
  },
  '/projects/new': {
    title: 'New Project',
    description: 'Create a new project and start organising your team\'s work.',
  },
  '/teams': {
    title: 'Teams',
    description: 'Build and manage teams, assign roles and collaborate.',
  },
  '/teams/new': {
    title: 'New Team',
    description: 'Create a new team and add members.',
  },
  '/meetings': {
    title: 'Meetings',
    description: 'Your meeting history — transcripts, summaries and action items.',
  },
  '/meetings/new': {
    title: 'New Meeting',
    description: 'Schedule a new meeting with AI transcription and summaries.',
  },
  '/meetings/join': {
    title: 'Join Meeting',
    description: 'Join an IntellMeet meeting.',
  },
  '/meetings/room': {
    title: 'Meeting Room',
    description: 'Live meeting room with real-time video, chat and screen share.',
  },
  '/tasks': {
    title: 'Tasks',
    description: 'Track tasks, assign owners and monitor progress.',
  },
  '/tasks/new': {
    title: 'New Task',
    description: 'Create a new task and assign it to your team.',
  },
  '/organization/members': {
    title: 'Members',
    description: 'Manage organisation members, roles and permissions.',
  },
  '/organization/work-roles': {
    title: 'Work Roles',
    description: 'Define work roles and responsibilities for your organisation.',
  },
  '/settings': {
    title: 'Settings',
    description: 'Manage your IntellMeet account and preferences.',
  },
  '/server-admin': {
    title: 'Admin',
    description: 'Server administration — organisations, telemetry and settings.',
  },
};

const defaultMeta = {
  title: SITE_NAME,
  description:
    'Real-time video meetings with AI transcription, summaries and action items.',
};

export function useSEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta =
      routeMeta[pathname] ??
      Object.entries(routeMeta).find(
        ([key]) => key !== '/' && pathname.startsWith(key),
      )?.[1] ??
      defaultMeta;

    document.title = `${meta.title} — ${SITE_NAME}`;

    let descriptionMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.name = 'description';
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.content = meta.description;
  }, [pathname]);
}
