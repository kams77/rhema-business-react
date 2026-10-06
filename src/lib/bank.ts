// src/lib/bank.ts — coordonnées bancaires des factures : uniquement celles saisies par le DG.
import type { Organization, OrganizationBankAccount } from '../types';

export const NOT_PROVIDED = 'Non renseigné';

/** Comptes bancaires renseignés pour l'organisation (liste vide si aucun). */
export function orgBankAccounts(org: Organization | undefined): OrganizationBankAccount[] {
  return (org?.bankAccounts || []).filter(a => a && a.bankName && a.bankName.trim());
}

/** Coordonnées à imprimer sur une facture ; jamais de numéro inventé. */
export function invoiceBankDetails(org: Organization | undefined, accountId?: string) {
  const accounts = orgBankAccounts(org);
  const a = accounts.find(x => x.id === accountId) || accounts[0];
  return {
    bankName: a?.bankName || NOT_PROVIDED,
    accountNumberUSD: a?.accountNumberUSD || NOT_PROVIDED,
    accountNumberCDF: a?.accountNumberCDF || NOT_PROVIDED,
    swiftBic: a?.swiftBic || NOT_PROVIDED,
    ibanOrRib: a?.ibanOrRib || NOT_PROVIDED,
  };
}
