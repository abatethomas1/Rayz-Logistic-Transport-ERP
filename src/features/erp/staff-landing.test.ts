import { it, expect } from 'vitest';
import { staffLanding } from './staff-landing';
it('external officer opens assigned port stages', () => expect(staffLanding('External Logistics Officer')).toEqual({ path: '/logistics' }));
it('internal officer opens local clearance tasks', () => expect(staffLanding('Internal Logistics Officer')).toEqual({ path: '/workspaces/$section', section: 'internal-logistics' }));
it('logistics manager opens department overview', () => expect(staffLanding('Logistics Manager')).toEqual({ path: '/workspaces/$section', section: 'logistics-overview' }));
it('dispatcher opens dispatch board', () => expect(staffLanding('Dispatcher')).toEqual({ path: '/transport' }));
it('finance officer opens finance work', () => expect(staffLanding('Finance Officer')).toEqual({ path: '/finance' }));
it('administrator opens staff administration', () => expect(staffLanding('Admin')).toEqual({ path: '/staff' }));