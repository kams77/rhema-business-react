// src/data/standardPayroll.ts
// Paramétrage conforme au Code du Travail & Fiscalité RDC (CNSS, IPR, INPP, ONEM)
// Devises autorisées : USD ($) et CDF (Franc Congolais) uniquement

import type { 
  PayrollSystemConfig, 
  PayrollAllowance, 
  PayrollSocialContribution, 
  PayrollTaxBracket 
} from '../types';

/**
 * Primes et Indemnités conformes aux pratiques en RDC & Convention Collective
 */
export const STANDARD_ALLOWANCES: PayrollAllowance[] = [
  {
    id: 'allw-1',
    name: 'Indemnité Légale de Transport',
    code: 'IND_TRANSP',
    type: 'fixe',
    defaultValue: 150, // 150 $ ou équivalent CDF
    isTaxable: false, // Non imposable dans les limites du barème officiel RDC
    isSubjectToSocialContributions: false,
    isActive: true,
    category: 'transport',
    description: 'Prise en charge forfaitaire du transport personnel domicile-travail.'
  },
  {
    id: 'allw-2',
    name: 'Indemnité de Logement',
    code: 'IND_LOGEM',
    type: 'pourcentage',
    defaultValue: 20, // 20% du salaire de base
    isTaxable: true,
    isSubjectToSocialContributions: true,
    isActive: true,
    category: 'logement',
    description: 'Indemnité conventionnelle ou contractuelle d\'hébergement.'
  },
  {
    id: 'allw-3',
    name: 'Prime de Fonction & Responsabilité Managériale',
    code: 'PRIME_RESP',
    type: 'fixe',
    defaultValue: 250, // 250 $
    isTaxable: true,
    isSubjectToSocialContributions: true,
    isActive: true,
    category: 'responsabilite',
    description: 'Attribuée aux cadres dirigeants, chefs de départements et directeurs.'
  },
  {
    id: 'allw-4',
    name: 'Indemnité de Restauration & Panier Repas',
    code: 'IND_REPAS',
    type: 'fixe',
    defaultValue: 100, // 100 $
    isTaxable: false,
    isSubjectToSocialContributions: false,
    isActive: true,
    category: 'repas',
    description: 'Prime panier pour le déjeuner lors des journées complètes sur site ou atelier.'
  },
  {
    id: 'allw-5',
    name: 'Prime de Rendement & Télécoms / VSAT',
    code: 'PRIME_REND',
    type: 'fixe',
    defaultValue: 180, // 180 $
    isTaxable: true,
    isSubjectToSocialContributions: true,
    isActive: true,
    category: 'performance',
    description: 'Prime technique liée à la disponibilité opérationnelle des liaisons VSAT & Réseau.'
  },
  {
    id: 'allw-6',
    name: 'Allocations Familiales Extra-Légales',
    code: 'ALLOC_FAM',
    type: 'fixe',
    defaultValue: 35, // 35 $ par enfant
    isTaxable: false,
    isSubjectToSocialContributions: false,
    isActive: false,
    category: 'autre',
    description: 'Soutien aux charges familiales accordé par la politique RH interne.'
  }
];

/**
 * Cotisations Sociales & Parafiscales RDC (CNSS, INPP, ONEM, Assurance Santé)
 */
export const STANDARD_SOCIAL_CONTRIBUTIONS: PayrollSocialContribution[] = [
  {
    id: 'sc-1',
    name: 'CNSS - Caisse Nationale de Sécurité Sociale (Branche Pensions)',
    code: 'CNSS_PENS',
    employeeRate: 5.0, // 5% part employé RDC
    employerRate: 5.0, // 5% part employeur
    ceilingAmount: undefined,
    isActive: true,
    description: 'Cotisation obligatoire au régime général de retraite de la RDC.'
  },
  {
    id: 'sc-2',
    name: 'CNSS - Risques Professionnels & Prestations aux Familles',
    code: 'CNSS_RISQ',
    employeeRate: 0.0, // Exclusivement patronal en RDC
    employerRate: 8.0, // 4% risques professionnels + 4% prestations familiales
    ceilingAmount: undefined,
    isActive: true,
    description: 'Prise en charge patronale des accidents du travail et allocations.'
  },
  {
    id: 'sc-3',
    name: 'INPP - Institut National de Préparation Professionnelle',
    code: 'INPP_FORMATION',
    employeeRate: 0.0,
    employerRate: 3.0, // 3% employeur (taux applicable aux entreprises de taille moyenne en RDC)
    ceilingAmount: undefined,
    isActive: true,
    description: 'Contribution patronale obligatoire à la formation professionnelle continue.'
  },
  {
    id: 'sc-4',
    name: 'ONEM - Office National de l\'Emploi',
    code: 'ONEM_TAX',
    employeeRate: 0.0,
    employerRate: 0.2, // 0.2% en RDC
    ceilingAmount: undefined,
    isActive: true,
    description: 'Contribution obligatoire au fonds national pour la promotion de l\'emploi.'
  },
  {
    id: 'sc-5',
    name: 'Assurance Maladie & Soins Médicaux (Prise en charge RHEMA)',
    code: 'ASSUR_SANTE',
    employeeRate: 2.0, // 2% salarial
    employerRate: 4.0, // 4% patronal
    ceilingAmount: undefined,
    isActive: true,
    description: 'Couverture médicale conventionnelle entreprise pour soins et hospitalisation.'
  }
];

/**
 * Barème Fiscal IPR (Impôt Professionnel sur les Rémunérations - RDC)
 */
export const STANDARD_TAX_BRACKETS: PayrollTaxBracket[] = [
  { id: 'tb-1', min: 0, max: 200, rate: 3 },     // 0 à 200 $ (ou équivalent CDF) -> 3%
  { id: 'tb-2', min: 200, max: 600, rate: 10 },  // 200 à 600 $ -> 10%
  { id: 'tb-3', min: 600, max: 1500, rate: 20 }, // 600 à 1 500 $ -> 20%
  { id: 'tb-4', min: 1500, max: 3000, rate: 30 },// 1 500 à 3 000 $ -> 30%
  { id: 'tb-5', min: 3000, max: null, rate: 40 } // Au-delà de 3 000 $ -> 40% (Plafonné à 30% global)
];

/**
 * Taux de change légal RDC de référence (USD <-> CDF)
 */
export const DEFAULT_EXCHANGE_RATE_USD_CDF = 2850; // 1 USD = 2850 CDF

/**
 * Crée le système de paie standard RDC pour une organisation
 */
export function createStandardPayrollSystem(organizationId: string, orgName: string = 'RHEMA BUSINESS'): PayrollSystemConfig {
  return {
    id: `pay-sys-${organizationId}`,
    organizationId,
    isStandardTemplate: true,
    systemName: `Système Officiel de Paie & RH RDC (${orgName})`,
    currency: 'USD', // Devises autorisées : USD ou CDF uniquement
    standardMonthlyHours: 173.33,
    overtimeRates: {
      firstBracketRate: 30, // Heures sup jour ouvré (+30% Code du travail RDC)
      secondBracketRate: 60, // Heures sup nuit (+60%)
      weekendHolidayRate: 100, // Dimanches et jours fériés légaux (+100%)
    },
    payFrequency: 'mensuelle',
    allowances: JSON.parse(JSON.stringify(STANDARD_ALLOWANCES)),
    socialContributions: JSON.parse(JSON.stringify(STANDARD_SOCIAL_CONTRIBUTIONS)),
    taxConfig: {
      taxName: 'IPR (Impôt Professionnel sur les Rémunérations - RDC)',
      type: 'progressif',
      brackets: JSON.parse(JSON.stringify(STANDARD_TAX_BRACKETS)),
      creditPerDependentChild: 10, // Réduction d'IPR par charge de famille (enfant)
      localDevelopmentTax: 0,
    },
    seniorityBonusPerTwoYearsPercent: 3, // 3% tous les 2 ans
    lastModifiedBy: 'Système RH RDC (Code du Travail)',
    lastModifiedAt: new Date().toISOString().slice(0, 10),
    notes: 'Système conforme au Code du Travail de la République Démocratique du Congo (RDC). Seules les devises USD ($) et Franc Congolais (CDF) sont autorisées. Cotisations CNSS (5% employé, 13% patronal), INPP (3%), ONEM (0.2%) et barème progressif d\'IPR.'
  };
}

export interface PayslipSimulationResult {
  baseSalary: number;
  seniorityBonus: number;
  activeAllowances: {
    name: string;
    code: string;
    amount: number;
    isTaxable: boolean;
    isSubjectToSocial: boolean;
  }[];
  grossSalary: number;
  grossTaxableSalary: number;
  grossSocialSalary: number;
  employeeContributions: {
    name: string;
    code: string;
    rate: number;
    base: number;
    amount: number;
  }[];
  totalEmployeeContributions: number;
  employerContributions: {
    name: string;
    code: string;
    rate: number;
    base: number;
    amount: number;
  }[];
  totalEmployerContributions: number;
  taxableNet: number;
  irppTax: number; // IPR en RDC
  dependentCredit: number;
  localTax: number;
  totalTaxes: number;
  netPay: number;
  totalEmployerCost: number;
}

/**
 * Calcul précis du bulletin conforme RDC (USD ou CDF)
 */
export function calculatePayslipSimulation(
  config: PayrollSystemConfig,
  baseSalary: number = 1200,
  seniorityYears: number = 4,
  dependentsCount: number = 2
): PayslipSimulationResult {
  const safeBase = Math.max(0, baseSalary || 0);

  // 1. Prime d'ancienneté (3% tous les 2 ans selon standard RDC)
  const seniorityBonus = Math.round(
    safeBase * (Math.floor((seniorityYears || 0) / 2) * ((config.seniorityBonusPerTwoYearsPercent || 3) / 100))
  );

  // 2. Primes actives
  const activeAllowances = config.allowances
    .filter(a => a.isActive)
    .map(a => {
      const amount = a.type === 'fixe' ? a.defaultValue : Math.round(safeBase * (a.defaultValue / 100));
      return {
        name: a.name,
        code: a.code,
        amount,
        isTaxable: a.isTaxable,
        isSubjectToSocial: a.isSubjectToSocialContributions,
      };
    });

  const totalAllowances = activeAllowances.reduce((acc, curr) => acc + curr.amount, 0);
  const grossSalary = safeBase + seniorityBonus + totalAllowances;

  // Assiette cotisations sociales
  const socialAllowancesTotal = activeAllowances
    .filter(a => a.isSubjectToSocial)
    .reduce((acc, curr) => acc + curr.amount, 0);
  const grossSocialBase = safeBase + seniorityBonus + socialAllowancesTotal;

  // 3. Cotisations sociales salariales (CNSS 5% + Mutuelle 2%)
  const employeeContributions = config.socialContributions
    .filter(sc => sc.isActive && sc.employeeRate > 0)
    .map(sc => {
      const base = sc.ceilingAmount ? Math.min(grossSocialBase, sc.ceilingAmount) : grossSocialBase;
      const amount = Math.round(base * (sc.employeeRate / 100));
      return {
        name: sc.name,
        code: sc.code,
        rate: sc.employeeRate,
        base,
        amount,
      };
    });

  const totalEmployeeContributions = employeeContributions.reduce((acc, c) => acc + c.amount, 0);

  // Charges patronales (CNSS 13%, INPP 3%, ONEM 0.2%, Mutuelle 4%)
  const employerContributions = config.socialContributions
    .filter(sc => sc.isActive && sc.employerRate > 0)
    .map(sc => {
      const base = sc.ceilingAmount ? Math.min(grossSocialBase, sc.ceilingAmount) : grossSocialBase;
      const amount = Math.round(base * (sc.employerRate / 100));
      return {
        name: sc.name,
        code: sc.code,
        rate: sc.employerRate,
        base,
        amount,
      };
    });

  const totalEmployerContributions = employerContributions.reduce((acc, c) => acc + c.amount, 0);

  // 4. Assiette Fiscale IPR
  const taxableAllowancesTotal = activeAllowances
    .filter(a => a.isTaxable)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const grossTaxableSalary = safeBase + seniorityBonus + taxableAllowancesTotal;
  const taxableNet = Math.max(0, grossTaxableSalary - totalEmployeeContributions);

  // 5. Calcul IPR Barème progressif RDC
  let iprTax = 0;
  if (config.taxConfig.type === 'progressif') {
    for (const bracket of config.taxConfig.brackets) {
      if (taxableNet > bracket.min) {
        const bracketCap = bracket.max !== null ? bracket.max : taxableNet;
        const taxableAmountInBracket = Math.min(taxableNet, bracketCap) - bracket.min;
        if (taxableAmountInBracket > 0) {
          iprTax += Math.round(taxableAmountInBracket * (bracket.rate / 100));
        }
      }
    }
  } else {
    iprTax = Math.round(taxableNet * ((config.taxConfig.flatRate || 15) / 100));
  }

  // Réduction pour enfants à charge
  const dependentCredit = Math.min(iprTax, (dependentsCount || 0) * (config.taxConfig.creditPerDependentChild || 10));
  iprTax = Math.max(0, iprTax - dependentCredit);

  const localTax = config.taxConfig.localDevelopmentTax || 0;
  const totalTaxes = iprTax + localTax;

  // 6. Net à payer & Coût global employeur
  const netPay = Math.max(0, grossSalary - totalEmployeeContributions - totalTaxes);
  const totalEmployerCost = grossSalary + totalEmployerContributions;

  return {
    baseSalary: safeBase,
    seniorityBonus,
    activeAllowances,
    grossSalary,
    grossTaxableSalary,
    grossSocialSalary: grossSocialBase,
    employeeContributions,
    totalEmployeeContributions,
    employerContributions,
    totalEmployerContributions,
    taxableNet,
    irppTax: iprTax,
    dependentCredit,
    localTax,
    totalTaxes,
    netPay,
    totalEmployerCost,
  };
}

/**
 * Configurations initiales pré-chargées pour les organisations
 */
export const initialPayrollConfigs: Record<string, PayrollSystemConfig> = {
  'org-1': {
    ...createStandardPayrollSystem('org-1', 'RHEMA BUSINESS'),
    isStandardTemplate: false,
    systemName: 'Système Paie & Rémunérations RH RDC (RHEMA BUSINESS)',
    currency: 'USD',
    lastModifiedBy: 'Junior Monya (Directeur Général)',
    lastModifiedAt: '2026-09-20',
    notes: 'Système officiel RHEMA BUSINESS conforme au Code du Travail RDC. Seules les devises USD ($) et CDF sont autorisées. Cotisations CNSS (5% salarié, 13% patronal), INPP (3%), ONEM (0.2%) et barème progressif d\'IPR.'
  },
  'org-2': createStandardPayrollSystem('org-2', 'Institut Supérieur d\'Ingénierie & Management'),
  'org-3': createStandardPayrollSystem('org-3', 'Fondation Humanitaire Espoir & Développement'),
};