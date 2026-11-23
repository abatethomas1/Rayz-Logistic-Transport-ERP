import yangtzeLogo from '@/assets/yangtze-logistics-logo.png.asset.json';
import type { CompanyMembership } from './django-contract';

export function CompanyLogo({ company }: { company: Pick<CompanyMembership, 'name' | 'branding'> }) {
  const logo = company.branding.logo_url || (company.name === 'Yangtze Logistics & Transport' ? yangtzeLogo.url : '');
  if (!logo) return <div className="brand-mark">{company.name.charAt(0)}</div>;
  return <img src={logo} alt={`${company.branding.display_name || company.name} logo`} width={375} height={125} className="w-20 sm:w-28 h-10 shrink-0 object-contain rounded-sm bg-background p-1" />;
}