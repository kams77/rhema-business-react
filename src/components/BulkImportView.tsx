// src/components/BulkImportView.tsx — import CSV des comptes collaborateurs.
// Crée les comptes (nom, poste, entité, email, téléphone, matricule). Aucune donnée de contrat,
// de salaire ni de banque n'est importée : le module RH / paie a été retiré de l'application.
import React, { useState, useId } from 'react';
import { DEMO_MODE, DEMO_PASSWORD } from '../config';
import { generateTemporaryPassword } from '../lib/auth';
import type { User, Organization, HierarchicalEntity, UserRole } from '../types';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import { titleHasAny, entityPlacement } from '../utils/rbac';
import { csvRow } from '../utils/exportUtils';

interface BulkImportViewProps {
  currentUser: User;
  currentOrg: Organization;
  entities: HierarchicalEntity[];
  users: User[];
  onImportUsers: (newUsers: User[], auditNote: string) => void;
}

interface ParsedEmployeeRow {
  index: number;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: UserRole;
  roleTitle: string;
  nomEntite: string;
  isValid: boolean;
  errors: string[];
}

export const BulkImportView: React.FC<BulkImportViewProps> = ({
  currentOrg,
  entities,
  users,
  onImportUsers,
}) => {
  const employeesFileInputId = useId();

  const [employeeRawCSV, setEmployeeRawCSV] = useState('');
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployeeRow[]>([]);
  const [employeeImportSuccess, setEmployeeImportSuccess] = useState<string | null>(null);

  // =========================================================================
  // GABARIT CSV TÉLÉCHARGEABLE
  // =========================================================================
  const downloadEmployeeTemplate = () => {
    const header = "matricule,nom,prenom,email,telephone,role,intitule_poste,nom_entite\n";
    const sample = [
      "MAT-2026-101,Kalombo,Dieudonné,d.kalombo@exemple.cd,+243 81 222 3344,agent,Technicien Faisceaux Hertziens,Service Déploiement VSAT",
      "MAT-2026-102,Mwamba,Nathalie,n.mwamba@exemple.cd,+243 82 333 4455,agent,Comptable Auxiliaire,Service Comptabilité & Trésorerie",
      "MAT-2026-103,Mutombo,Gabriel,g.mutombo@exemple.cd,+243 99 444 5566,chef_service,Superviseur NOC Réseau,Service Support & Supervision",
    ].join("\n");

    const blob = new Blob(['\uFEFF' + header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gabarit_Import_Collaborateurs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // =========================================================================
  // PARSEUR CSV EMPLOYÉS AVEC CONTRÔLE DE VALIDITÉ RDC
  // =========================================================================
  const parseEmployeesCSV = (csvText: string) => {
    setEmployeeImportSuccess(null);
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setParsedEmployees([]);
      return;
    }

    // Détection séparateur (, ou ;)
    const sep = lines[0].includes(';') ? ';' : ',';
    // Découpage CSV : champs entre guillemets (virgules et apostrophes conservées, « "" » = guillemet).
    const splitCsv = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let quoted = false;
      for (let k = 0; k < line.length; k++) {
        const ch = line[k];
        if (quoted) {
          if (ch === '"' && line[k + 1] === '"') { cur += '"'; k++; }
          else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === sep) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      out.push(cur.trim());
      // Apostrophe ajoutée par nos exports pour neutraliser les formules : retirée à l'import.
      return out.map(v => (/^'[=+\-@]/.test(v) ? v.slice(1) : v));
    };
    const headers = splitCsv(lines[0]).map(h => h.toLowerCase().replace(/^\uFEFF/, '').trim());

    const result: ParsedEmployeeRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitCsv(lines[i]);
      if (values.length < 3) continue;

      const getVal = (possibleKeys: string[]): string => {
        for (const k of possibleKeys) {
          const idx = headers.indexOf(k);
          if (idx !== -1 && values[idx] !== undefined) return values[idx];
        }
        return '';
      };

      // Aucune valeur inventée : une donnée absente reste vide (ou rend la ligne invalide si elle est obligatoire).
      const matricule = getVal(['matricule', 'id', 'mat', 'code']);
      const nom = getVal(['nom', 'lastname', 'name']);
      const prenom = getVal(['prenom', 'firstname']) || '';
      const email = getVal(['email', 'mail']).toLowerCase();
      const telephone = getVal(['telephone', 'phone', 'tel']);
      const rawRole = getVal(['role', 'grade', 'statut']).toLowerCase();
      
      let role: UserRole = 'agent';
      // Comparaison par mots entiers : « Budget » ne doit jamais donner le rôle DG.
      if (rawRole === 'dg' || titleHasAny(rawRole, ['dg', 'pdg', 'directeur general'])) role = 'dg';
      else if (rawRole.includes('chef_departement') || titleHasAny(rawRole, ['departement', 'chef departement'])) role = 'chef_departement';
      else if (titleHasAny(rawRole, ['directeur', 'directrice', 'dir'])) role = 'directeur';
      else if (rawRole.includes('chef_division') || titleHasAny(rawRole, ['division'])) role = 'chef_division';
      else if (rawRole.includes('chef_service') || titleHasAny(rawRole, ['service', 'chef service'])) role = 'chef_service';

      const roleTitle = getVal(['intitule_poste', 'poste', 'fonction', 'title']);
      const nomEntite = getVal(['nom_entite', 'entite', 'service', 'departement']);

      // Validation
      const errors: string[] = [];
      if (!nom) errors.push("Nom obligatoire");
      if (!matricule) errors.push("Matricule obligatoire");
      if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(email ? "Email invalide" : "Email obligatoire (identifiant de connexion)");
      if (!roleTitle) errors.push("Intitulé du poste obligatoire");
      if (role === 'dg') errors.push("Le rôle DG ne s'importe pas : il est attribué par la Direction Générale");
      if (!nomEntite) errors.push("Entité (nom_entite) obligatoire");
      else if (!findEntity(nomEntite)) errors.push(`Entité « ${nomEntite} » introuvable dans l'organigramme (créez-la d'abord)`);
      if (result.some(r => r.email === email && email)) errors.push("Email en double dans le fichier");
      if (result.some(r => r.matricule && r.matricule.toLowerCase() === matricule.toLowerCase())) errors.push("Matricule en double dans le fichier");
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        errors.push("Email déjà existant dans l'ERP");
      }
      if (users.some(u => u.matricule && u.matricule.toLowerCase() === matricule.toLowerCase())) {
        errors.push("Matricule déjà attribué");
      }

      result.push({ index: i, matricule, nom, prenom, email, telephone, role, roleTitle, nomEntite, isValid: errors.length === 0, errors });
    }

    setParsedEmployees(result);
  };



  /** Entité désignée dans le fichier : nom ou code exact (sans tenir compte des majuscules), sinon nom partiel unique. */
  function findEntity(label: string): HierarchicalEntity | undefined {
    const v = label.trim().toLowerCase();
    if (!v) return undefined;
    const exact = entities.find(e => e.name.trim().toLowerCase() === v || e.code.trim().toLowerCase() === v);
    if (exact) return exact;
    const partial = entities.filter(e => e.name.toLowerCase().includes(v));
    return partial.length === 1 ? partial[0] : undefined;
  }

  // Exécution de l'import des comptes
  const handleExecuteEmployeeImport = () => {
    const valids = parsedEmployees.filter(e => e.isValid);
    if (valids.length === 0) return;

    const newUsers: User[] = [];
    // Identifiants provisoires à transmettre aux collaborateurs (changement obligatoire à la 1re connexion).
    const credentials: Array<{ name: string; email: string; matricule: string; password: string }> = [];

    valids.forEach(row => {
      const userId = `usr-csv-${Date.now()}-${row.index}-${Math.random().toString(36).substring(2, 6)}`;
      // Entité vérifiée à l'analyse du fichier (ligne invalide si introuvable).
      const matchedEntity = findEntity(row.nomEntite);
      const fullUserName = row.prenom ? `${row.nom} ${row.prenom}` : row.nom;

      const newUser: User = {
        id: userId,
        name: fullUserName,
        email: row.email,
        matricule: row.matricule,
        employeeCode: row.matricule,
        password: DEMO_MODE ? DEMO_PASSWORD : generateTemporaryPassword(),
        mustChangePassword: !DEMO_MODE,
        role: row.role,
        roleTitle: row.roleTitle,
        organizationId: currentOrg.id,
        ...entityPlacement(matchedEntity?.id, entities),
        status: 'actif',
        failedAccessAttempts: 0,
        phone: row.telephone,
        canCreateSubAgents: row.role !== 'agent',
        canApproveServiceDocuments: false
      };

      newUsers.push(newUser);
      credentials.push({ name: fullUserName, email: row.email, matricule: row.matricule, password: newUser.password! });
    });

    onImportUsers(newUsers, `Import CSV de ${newUsers.length} compte(s) collaborateur(s).`);

    if (!DEMO_MODE) {
      // Fichier à remettre aux collaborateurs puis à détruire : c'est la seule fois où les mots de passe sont visibles.
      const csv = ['Nom;Email;Matricule;Mot de passe provisoire']
        .concat(credentials.map(c => csvRow([c.name, c.email, c.matricule, c.password])))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `identifiants-provisoires-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    setEmployeeImportSuccess(
      `Succès : ${newUsers.length} nouveau(x) compte(s) collaborateur(s) ajouté(s) à l'annuaire.` +
      (DEMO_MODE
        ? ` Mot de passe de démonstration : ${DEMO_PASSWORD}.`
        : ' Les mots de passe provisoires ont été téléchargés (fichier CSV) : remettez-les aux collaborateurs puis supprimez ce fichier.')
    );
    setParsedEmployees([]);
    setEmployeeRawCSV('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-100">
      
      {/* 1. EN-TÊTE PRINCIPAL */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
              DIRECTION & RESPONSABLES
            </span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mots de passe provisoires, changement obligatoire</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-indigo-400" />
            <span>Import CSV des comptes collaborateurs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Création des comptes en une fois depuis un fichier CSV : nom, poste, entité, email (identifiant de connexion), téléphone et matricule. Chaque ligne est contrôlée avant l'import.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadEmployeeTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Gabarit CSV</span>
          </button>
        </div>
      </div>

      {/* IMPORT DES COMPTES */}
      {(
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <span>Importer un fichier CSV de collaborateurs</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Séparateurs virgule (,) ou point-virgule (;). Vérifie les matricules, les emails et les entités de l'organigramme.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id={employeesFileInputId}
                  accept=".csv,text/csv"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => {
                        const content = event.target?.result as string;
                        setEmployeeRawCSV(content);
                        parseEmployeesCSV(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor={employeesFileInputId}
                  className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sélectionner le fichier CSV</span>
                </label>
              </div>
            </div>

            {/* Zone de saisie / collage direct */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">
                Ou collez directement vos lignes CSV ci-dessous :
              </label>
              <textarea
                rows={4}
                value={employeeRawCSV}
                onChange={e => {
                  setEmployeeRawCSV(e.target.value);
                  parseEmployeesCSV(e.target.value);
                }}
                placeholder="matricule,nom,prenom,email,telephone,role,intitule_poste,nom_entite"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {employeeImportSuccess && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{employeeImportSuccess}</span>
              </div>
            )}
          </div>

          {/* Tableau de Prévisualisation des lignes parsées */}
          {parsedEmployees.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-white">
                    Prévisualisation & contrôle ({parsedEmployees.length} lignes)
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="text-emerald-400 font-semibold">
                      ✓ {parsedEmployees.filter(e => e.isValid).length} Valides
                    </span>
                    {parsedEmployees.filter(e => !e.isValid).length > 0 && (
                      <span className="text-rose-400 font-semibold">
                        ✗ {parsedEmployees.filter(e => !e.isValid).length} Anomalies à corriger
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleExecuteEmployeeImport}
                  disabled={parsedEmployees.filter(e => e.isValid).length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Créer les {parsedEmployees.filter(e => e.isValid).length} comptes</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Statut</th>
                      <th className="p-3">Matricule</th>
                      <th className="p-3">Nom & Prénom</th>
                      <th className="p-3">Email & Téléphone</th>
                      <th className="p-3">Poste & Entité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {parsedEmployees.map(row => (
                      <tr key={row.index} className={row.isValid ? 'hover:bg-slate-800/40' : 'bg-rose-950/20'}>
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ✓ Prêt
                            </span>
                          ) : (
                            <div className="text-[10px] text-rose-300 space-y-0.5">
                              {row.errors.map((err, ei) => (
                                <div key={ei} className="flex items-center gap-1 font-semibold">
                                  <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-white">{row.matricule}</td>
                        <td className="p-3 font-semibold text-slate-200">
                          {row.nom} {row.prenom}
                        </td>
                        <td className="p-3 text-slate-400">
                          <div>{row.email}</div>
                          <div className="text-[10px] font-mono text-slate-500">{row.telephone}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-300">{row.roleTitle}</div>
                          <div className="text-[10px] text-indigo-400">{row.nomEntite}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
