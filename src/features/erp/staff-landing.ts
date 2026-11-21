import type { Role } from './model';
export function staffLanding(role: Role): { path: '/' | '/logistics' | '/transport' | '/finance' | '/staff' | '/workspaces/$section'; section?: string } {
  if (role === 'Admin') return { path: '/staff' };
  if (role === 'External Logistics Officer') return { path: '/logistics' };
  if (role === 'Internal Logistics Officer') return { path: '/workspaces/$section', section: 'internal-logistics' };
  if (role === 'Logistics Manager') return { path: '/workspaces/$section', section: 'logistics-overview' };
  if (['Transport Manager','Transport Officer','Dispatcher'].includes(role)) return { path: '/transport' };
  if (['Finance Manager','Finance Officer','Accountant'].includes(role)) return { path: '/finance' };
  return { path: '/' };
}