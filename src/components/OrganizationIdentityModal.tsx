// src/components/OrganizationIdentityModal.tsx
// Fenêtre « Identité & Logo » de l'organisation (modification réservée au DG).
import React, { useState } from 'react';
import { Sparkles, X, Check, Lock, Plus, Trash2, Landmark } from 'lucide-react';
import type { Organization, OrganizationBankAccount } from '../types';

interface OrganizationIdentityModalProps {
  organization: Organization;
  canEdit: boolean;
  onClose: () => void;
  onSave: (updated: Organization) => void;
}

const buildForm = (org: Organization) => ({
  name: org.name,
  type: org.type,
  registrationNumber: org.rccm || org.registrationNumber || '',
  idNat: org.idNat || '',
  numImpot: org.numImpot || '',
  bankAccounts: (org.bankAccounts || []).map(a => ({ ...a })) as OrganizationBankAccount[],
  headquarters: org.headquarters || '',
  email: org.email || '',
  phone: org.phone || '',
  managerName: org.managerName || '',
  managerRole: org.managerRole || 'Directeur Général (DG)',
  description: org.description || '',
  logoUrl: org.logo || '',
});

export const OrganizationIdentityModal: React.FC<OrganizationIdentityModalProps> = ({
  organization,
  canEdit,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState(() => buildForm(organization));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !form.name.trim()) return;
    onSave({
      ...organization,
      name: form.name.trim(),
      type: form.type,
      registrationNumber: form.registrationNumber.trim(),
      rccm: form.registrationNumber.trim(),
      idNat: form.idNat.trim(),
      numImpot: form.numImpot.trim(),
      bankAccounts: form.bankAccounts
        .map(a => ({ ...a, bankName: a.bankName.trim() }))
        .filter(a => a.bankName),
      headquarters: form.headquarters.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      managerName: form.managerName.trim(),
      managerRole: form.managerRole.trim(),
      description: form.description,
      logo: form.logoUrl || undefined,
    });
  };

  return (
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Identité de l'organisation"
        onKeyDown={e => e.key === 'Escape' && onClose()}
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Identité & Logo Officiels (DG)</h3>
                <p className="text-xs text-slate-400">Paramétrage scellé pour les fiches officielles, devis et en-têtes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClose()}
              aria-label="Fermer"
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!canEdit && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              Consultation seule : seule la Direction Générale peut modifier l'identité de l'organisation.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <fieldset disabled={!canEdit} className="contents">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-slate-300 font-semibold block mb-1">Raison Sociale / Nom Officiel *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Type d'Organisation</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="entreprise">Entreprise Commerciale (SA / SARL)</option>
                  <option value="etablissement">Établissement Public</option>
                  <option value="ong">ONG / Association</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">N° RCCM / Enregistrement *</label>
                <input
                  type="text"
                  required
                  value={form.registrationNumber}
                  onChange={e => setForm({ ...form, registrationNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-300 font-semibold block mb-1">Siège Social & Adresse Légale</label>
                <input
                  type="text"
                  value={form.headquarters}
                  onChange={e => setForm({ ...form, headquarters: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email de Contact Officiel</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Téléphone Opérationnel</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nom du Dirigeant / DG</label>
                <input
                  type="text"
                  value={form.managerName}
                  onChange={e => setForm({ ...form, managerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">URL du Logo (ou vide pour badge RB)</label>
                <input
                  type="url"
                  placeholder="https://.../logo.png"
                  value={form.logoUrl}
                  onChange={e => setForm({ ...form, logoUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Identification nationale (Id. Nat)</label>
                <input
                  type="text"
                  value={form.idNat}
                  onChange={e => setForm({ ...form, idNat: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Numéro d'impôt (NIF)</label>
                <input
                  type="text"
                  value={form.numImpot}
                  onChange={e => setForm({ ...form, numImpot: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-indigo-400" /> Coordonnées bancaires (imprimées sur les factures)
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      bankAccounts: [...form.bankAccounts, { id: `bank-${Date.now()}`, bankName: '', accountNumberUSD: '', accountNumberCDF: '', swiftBic: '', ibanOrRib: '' }],
                    })}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un compte
                  </button>
                </div>
                {form.bankAccounts.length === 0 && (
                  <p className="text-slate-500">Aucun compte : les factures afficheront « Non renseigné ».</p>
                )}
                {form.bankAccounts.map((a, idx) => {
                  const update = (field: keyof OrganizationBankAccount, value: string) =>
                    setForm({ ...form, bankAccounts: form.bankAccounts.map((x, i) => (i === idx ? { ...x, [field]: value } : x)) });
                  return (
                    <div key={a.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      {([
                        ['bankName', 'Banque'],
                        ['swiftBic', 'SWIFT / BIC'],
                        ['accountNumberUSD', 'Compte USD'],
                        ['accountNumberCDF', 'Compte CDF'],
                        ['ibanOrRib', 'IBAN / RIB'],
                      ] as Array<[keyof OrganizationBankAccount, string]>).map(([field, label]) => (
                        <input
                          key={field}
                          aria-label={label}
                          placeholder={label}
                          value={a[field]}
                          onChange={e => update(field, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, bankAccounts: form.bankAccounts.filter((_, i) => i !== idx) })}
                        className="px-2 py-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10 flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Retirer
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-300 font-semibold block mb-1">Description / Objet Social</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            </fieldset>
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700"
              >
                Annuler
              </button>
              {canEdit && (
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer l'Identité</span>
              </button>
              )}
            </div>
          </form>
        </div>
      </div>
  );
};
