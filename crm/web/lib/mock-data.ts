// Demo data for the UI phase. Mirrors the Phase-1 database seed so the
// interface reflects the real schema. No backend required to explore the UX.

export type Stage =
  | "new"
  | "contacted"
  | "qualified"
  | "negotiation"
  | "won";

export const STAGES: { id: Stage; label: string; colorVar: string }[] = [
  { id: "new", label: "جديد", colorVar: "--stage-new" },
  { id: "contacted", label: "تم التواصل", colorVar: "--stage-contacted" },
  { id: "qualified", label: "مؤهّل", colorVar: "--stage-qualified" },
  { id: "negotiation", label: "تفاوض", colorVar: "--stage-negotiation" },
  { id: "won", label: "إغلاق ✓", colorVar: "--stage-won" },
];

export type Company = {
  id: string;
  name: string;
  slug: string;
  logo: string; // single monogram letter for the badge
  type: "developer" | "brokerage";
  leads: number;
  agents: number;
  conversion: number; // %
  color: string;
};

export const companies: Company[] = [
  { id: "al-noor", name: "شركة النور للتطوير العقاري", slug: "al-noor", logo: "ن", type: "developer", leads: 236, agents: 6, conversion: 14, color: "#2E7CF6" },
  { id: "horizon", name: "أفق للتسويق العقاري", slug: "horizon", logo: "أ", type: "brokerage", leads: 118, agents: 4, conversion: 11, color: "#7C3AED" },
  { id: "marina", name: "مارينا العقارية", slug: "marina", logo: "م", type: "developer", leads: 342, agents: 9, conversion: 17, color: "#0EA5A4" },
  { id: "sakan", name: "سكن للاستثمار", slug: "sakan", logo: "س", type: "brokerage", leads: 87, agents: 3, conversion: 9, color: "#F59E0B" },
];

export type Agent = {
  id: string;
  name: string;
  active: number; // active leads
  closed: number; // closed this month
  score: number; // performance 0-100
};

export const agents: Agent[] = [
  { id: "karim", name: "كريم منصور", active: 8, closed: 5, score: 82 },
  { id: "sara", name: "سارة أحمد", active: 6, closed: 3, score: 68 },
  { id: "omar", name: "عمر خالد", active: 9, closed: 6, score: 88 },
  { id: "hala", name: "هالة سمير", active: 5, closed: 2, score: 61 },
];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  stage: Stage;
  source: string;
  campaign: string;
  budgetMin: number;
  budgetMax: number;
  area: string;
  quality: number; // 0-100
  agentId: string;
  slaMinutes?: number; // remaining SLA for new leads
  aiTip?: string;
};

export const leads: Lead[] = [
  { id: "l1", name: "محمد عبد الله", phone: "+201000000001", stage: "new", source: "Facebook", campaign: "التجمع الخامس", budgetMin: 3000000, budgetMax: 4000000, area: "التجمع الخامس", quality: 78, agentId: "karim", slaMinutes: 27, aiTip: "اعرض مشروع النور بارك — يطابق ميزانيته ومنطقته." },
  { id: "l2", name: "ليلى حسن", phone: "+201000000002", stage: "new", source: "Facebook", campaign: "التجمع الخامس", budgetMin: 2000000, budgetMax: 2500000, area: "التجمع الخامس", quality: 64, agentId: "sara", slaMinutes: 12 },
  { id: "l3", name: "خالد فؤاد", phone: "+201000000003", stage: "contacted", source: "Google", campaign: "الشيخ زايد", budgetMin: 5000000, budgetMax: 7000000, area: "الشيخ زايد", quality: 88, agentId: "omar", aiTip: "عميل ميزانيته عالية — رشّح له الفيلا V-01." },
  { id: "l4", name: "نور الدين", phone: "+201000000004", stage: "contacted", source: "Facebook", campaign: "التجمع الخامس", budgetMin: 1500000, budgetMax: 2000000, area: "التجمع الخامس", quality: 55, agentId: "karim" },
  { id: "l5", name: "هبة سمير", phone: "+201000000005", stage: "qualified", source: "Landing", campaign: "الساحل", budgetMin: 6000000, budgetMax: 9000000, area: "الساحل الشمالي", quality: 91, agentId: "omar", aiTip: "جاهزة للمعاينة — حدّد موعد زيارة." },
  { id: "l6", name: "عمرو ياسر", phone: "+201000000006", stage: "qualified", source: "Facebook", campaign: "التجمع الخامس", budgetMin: 2500000, budgetMax: 3000000, area: "التجمع الخامس", quality: 60, agentId: "sara" },
  { id: "l7", name: "دينا محمود", phone: "+201000000007", stage: "negotiation", source: "Instagram", campaign: "الشيخ زايد", budgetMin: 4000000, budgetMax: 5000000, area: "الشيخ زايد", quality: 84, agentId: "karim", aiTip: "قريب من الإغلاق — اعرض خطة سداد ٨ سنوات." },
  { id: "l8", name: "طارق سعيد", phone: "+201000000008", stage: "negotiation", source: "Referral", campaign: "مباشر", budgetMin: 7000000, budgetMax: 10000000, area: "الساحل الشمالي", quality: 93, agentId: "omar" },
  { id: "l9", name: "منى فتحي", phone: "+201000000009", stage: "won", source: "Facebook", campaign: "التجمع الخامس", budgetMin: 3500000, budgetMax: 4000000, area: "التجمع الخامس", quality: 80, agentId: "karim" },
];

export type Unit = {
  id: string;
  project: string;
  developer: string;
  code: string;
  type: "شقة" | "فيلا" | "شاليه" | "تجاري";
  area: string;
  sqm: number;
  bedrooms: number;
  price: number;
  status: "available" | "reserved" | "sold";
  image: string; // gradient token
};

export const units: Unit[] = [
  { id: "u1", project: "كمبوند النور بارك", developer: "شركة النور", code: "A-101", type: "شقة", area: "التجمع الخامس", sqm: 140, bedrooms: 3, price: 3500000, status: "available", image: "from-sky-100 to-indigo-100" },
  { id: "u2", project: "كمبوند النور بارك", developer: "شركة النور", code: "A-102", type: "شقة", area: "التجمع الخامس", sqm: 165, bedrooms: 3, price: 3900000, status: "available", image: "from-emerald-100 to-teal-100" },
  { id: "u3", project: "كمبوند النور بارك", developer: "شركة النور", code: "V-01", type: "فيلا", area: "التجمع الخامس", sqm: 320, bedrooms: 5, price: 6800000, status: "available", image: "from-amber-100 to-orange-100" },
  { id: "u4", project: "مارينا هيلز", developer: "مارينا العقارية", code: "M-210", type: "شاليه", area: "الساحل الشمالي", sqm: 110, bedrooms: 2, price: 5200000, status: "available", image: "from-cyan-100 to-blue-100" },
  { id: "u5", project: "مارينا هيلز", developer: "مارينا العقارية", code: "M-305", type: "شاليه", area: "الساحل الشمالي", sqm: 130, bedrooms: 3, price: 6100000, status: "reserved", image: "from-violet-100 to-purple-100" },
  { id: "u6", project: "زايد بلازا", developer: "أفق العقارية", code: "Z-14", type: "تجاري", area: "الشيخ زايد", sqm: 85, bedrooms: 0, price: 4400000, status: "available", image: "from-rose-100 to-pink-100" },
  { id: "u7", project: "زايد بلازا", developer: "أفق العقارية", code: "Z-22", type: "شقة", area: "الشيخ زايد", sqm: 150, bedrooms: 3, price: 4700000, status: "available", image: "from-lime-100 to-emerald-100" },
  { id: "u8", project: "كمبوند النور بارك", developer: "شركة النور", code: "A-118", type: "شقة", area: "التجمع الخامس", sqm: 175, bedrooms: 4, price: 4300000, status: "sold", image: "from-slate-100 to-gray-100" },
];

// Marketing dashboard KPIs
export const kpis = {
  totalCompanies: 92,
  totalLeads: 4820,
  distributedToday: 236,
  avgQuality: 72,
  closedThisMonth: 148,
  revenueThisMonth: 62_400_000,
};

export const leadSources = [
  { name: "Facebook", value: 46 },
  { name: "Google", value: 24 },
  { name: "Instagram", value: 16 },
  { name: "Landing", value: 9 },
  { name: "Referral", value: 5 },
];
