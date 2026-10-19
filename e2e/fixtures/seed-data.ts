export interface MockUser {
  name: string;
  email: string;
  role: 'Admin' | 'Member';
  jobTitle: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface MockProject {
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  assignedMemberEmails: string[];
}

export interface MockTeam {
  name: string;
  projectName: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  assignedMemberEmails: string[];
}

export interface MockTask {
  title: string;
  projectName: string;
  status: 'to_do' | 'in_progress' | 'bug' | 'backlog' | 'completed';
  description: string;
  assignedMemberEmails: string[];
}

export const SEED_CONFIG = {
  serverAdmin: {
    username: 'admin@intellmeet.internal',
    password: 'Vhhl@5ZeXUy%_Ut',
  },
  organization: {
    name: 'Apex Global Technologies',
    location: 'San Francisco, CA',
    description: 'Enterprise cloud infrastructure and real-time collaboration workspace.',
    adminName: 'Aswath Admin',
    adminEmail: 'admin@apexglobal.internal',
    defaultPassword: 'password123',
  },
  members: [
    {
      name: 'Elena Rostova',
      email: 'elena.rostova@apexglobal.internal',
      role: 'Admin',
      jobTitle: 'Principal Cloud Architect',
      status: 'ACTIVE',
    },
    {
      name: 'Marcus Chen',
      email: 'marcus.chen@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Senior Frontend Engineer',
      status: 'ACTIVE',
    },
    {
      name: 'Sophia Patel',
      email: 'sophia.patel@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Staff Product Designer',
      status: 'ACTIVE',
    },
    {
      name: 'David Kim',
      email: 'david.kim@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Lead DevOps & SRE Engineer',
      status: 'ACTIVE',
    },
    {
      name: 'Amara Okafor',
      email: 'amara.okafor@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Distributed Systems Engineer',
      status: 'ACTIVE',
    },
    {
      name: 'Lucas Vance',
      email: 'lucas.vance@apexglobal.internal',
      role: 'Member',
      jobTitle: 'QA Automation Specialist',
      status: 'ACTIVE',
    },
    {
      name: 'Chloe Bennett',
      email: 'chloe.bennett@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Technical Product Manager',
      status: 'ACTIVE',
    },
    {
      name: 'Ethan Wright',
      email: 'ethan.wright@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Data & Telemetry Engineer',
      status: 'ACTIVE',
    },
    {
      name: 'Nadia Al-Mansoor',
      email: 'nadia.almansoor@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Security & Compliance Officer',
      status: 'ACTIVE',
    },
    {
      name: 'Oliver Taylor',
      email: 'oliver.taylor@apexglobal.internal',
      role: 'Member',
      jobTitle: 'Fullstack Core Platform Dev',
      status: 'ACTIVE',
    },
  ] as MockUser[],

  projects: [
    {
      name: 'NextGen Mobile Ecosystem',
      description: 'Cross-platform mobile application suite with zero-latency presence & WebRTC.',
      status: 'active',
      assignedMemberEmails: [
        'elena.rostova@apexglobal.internal',
        'marcus.chen@apexglobal.internal',
        'sophia.patel@apexglobal.internal',
      ],
    },
    {
      name: 'Cloud Infrastructure Mesh',
      description: 'Multi-region Kubernetes ingress clustering, telemetry observability, and Redis cache replication.',
      status: 'active',
      assignedMemberEmails: [
        'david.kim@apexglobal.internal',
        'ethan.wright@apexglobal.internal',
      ],
    },
    {
      name: 'Enterprise Zero-Trust Security',
      description: 'Role-based access governance, cryptographic payload verification, and audit trace compliance.',
      status: 'active',
      assignedMemberEmails: [
        'elena.rostova@apexglobal.internal',
        'amara.okafor@apexglobal.internal',
        'lucas.vance@apexglobal.internal',
        'nadia.almansoor@apexglobal.internal',
        'oliver.taylor@apexglobal.internal',
      ],
    },
  ] as MockProject[],

  teams: [
    {
      name: 'Frontend Core Squad',
      projectName: 'NextGen Mobile Ecosystem',
      description: 'Owns user interfaces, animations, and high-cadence rendering.',
      status: 'active',
      assignedMemberEmails: [
        'marcus.chen@apexglobal.internal',
        'sophia.patel@apexglobal.internal',
      ],
    },
    {
      name: 'Site Reliability Engineering',
      projectName: 'Cloud Infrastructure Mesh',
      description: 'Platform resilience, container clusters, and incident automated response.',
      status: 'active',
      assignedMemberEmails: [
        'david.kim@apexglobal.internal',
        'ethan.wright@apexglobal.internal',
      ],
    },
  ] as MockTeam[],

  tasks: [
    {
      title: 'Implement Responsive Navigation Shell',
      projectName: 'NextGen Mobile Ecosystem',
      status: 'in_progress',
      description: 'Develop adaptable drawer layout and fluid transitions for mobile screen break-points.',
      assignedMemberEmails: ['marcus.chen@apexglobal.internal'],
    },
    {
      title: 'Multi-Region Terraform State Provisioning',
      projectName: 'Cloud Infrastructure Mesh',
      status: 'to_do',
      description: 'Bootstrap AWS VPC subnets and Redis cluster endpoints across secondary disaster recovery region.',
      assignedMemberEmails: ['david.kim@apexglobal.internal'],
    },
    {
      title: 'Enforce Asymmetric Signature On Token Exchange',
      projectName: 'Enterprise Zero-Trust Security',
      status: 'completed',
      description: 'Validate public keys in middleware pipeline before distributing signed session cookies.',
      assignedMemberEmails: ['nadia.almansoor@apexglobal.internal'],
    },
  ] as MockTask[],
};
