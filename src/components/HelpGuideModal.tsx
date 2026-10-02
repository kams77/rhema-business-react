import React from 'react';
import { 
  ShieldCheck, 
  HelpCircle, 
  Building2, 
  FileText, 
  Workflow, 
  ShieldAlert, 
  Lock, 
  Users, 
  CheckCircle2, 
  FileCode2,
  Sparkles
} from 'lucide-react';

interface HelpGuideModalProps {
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Guide des Règles & Spécifications Hiérarchiques</h3>
              <div className="text-[11px] text-slate-400">Synthèse du cahier des charges et des enrichissements ajoutés</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* 1. Types de comptes */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            1. Types d'Organisations & Hiérarchie Flexible
          </div>
          <p className="text-slate-300 leading-relaxed">
            L'application permet de créer des comptes pour <strong>Entreprise</strong>, <strong>Établissement</strong> et <strong>ONG</strong>. Une organisation peut activer ou non les échelons : <em>Département</em>, <em>Direction</em>, <em>Division</em> et <em>Service</em>.
          </p>
        </div>

        {/* 2. Rôles et portée de visibilité */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            2. Logique d'Authentification & Habilitations RBAC
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li><strong>DG / PDG / DGA :</strong> Super Utilisateur Global. Voit TOUT dans le système, du plus bas au plus haut niveau.</li>
            <li><strong>Chef de Département :</strong> Super Utilisateur de son Département et de ses sous-entités (Directions, Divisions, Services). Géré directement par le DG.</li>
            <li><strong>Directeur :</strong> Super Utilisateur de sa Direction et ses sous-entités. Géré par son Chef Dépt et le DG.</li>
            <li><strong>Chef de Division :</strong> Super Utilisateur de sa Division. Géré par son Directeur, Chef Dépt et DG.</li>
            <li><strong>Chef de Service :</strong> Super Utilisateur de son Service. Géré par sa chaîne hiérarchique.</li>
            <li><strong>Agents :</strong> Simples exécutants des tâches de leur service.</li>
          </ul>
        </div>

        {/* 3. Sécurité et Intrusion */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <div className="font-bold text-red-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            3. Détection d'Intrusion & Procédure Disciplinaire
          </div>
          <p className="text-slate-300 leading-relaxed">
            Lorsqu'un agent tente d'accéder à une entité hors de son périmètre, une alerte est émise et un message est transmis au <strong>DG</strong> et au <strong>responsable de l'entité ciblée</strong>. En cas d'insistance répétée (récidive), le compte est <strong>verrouillé</strong> et une <strong>convocation officielle</strong> devant le responsable de sécurité, le DG et la hiérarchie est émise.
          </p>
        </div>

        {/* 4. Documents & Règle stricte Bulletin de paie */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            4. Types de Documents & Règle Stricte Bulletin de Paie
          </div>
          <p className="text-slate-300 leading-relaxed">
            Trois filières : <strong>Financier & Comptable</strong>, <strong>Logistique & Commercial</strong>, <strong>Ressources Humaines</strong>.
            <br />
            <strong className="text-emerald-300">Règle stricte :</strong> Pour les Bulletins de Paie, seuls <em>l'agent titulaire</em>, le <em>Directeur des Ressources Humaines (DRH)</em> et le <em>Service Traitement de la Paie</em> ont le droit d'y accéder.
          </p>
        </div>

        {/* 5. Tâches & E-signature */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <div className="font-bold text-purple-400 flex items-center gap-1.5">
            <Workflow className="w-4 h-4" />
            5. Workflows de Tâches & Délégation d'E-Signature
          </div>
          <p className="text-slate-300 leading-relaxed">
            Gère 4 catégories de flux : Approbations (achats, notes de frais, congés), Production (ordres de fabrication, maintenance), Suivi client (relance impayés, réclamations), et Projets (jalons, relevé d'heures). Les chefs et DG apposent un scellé cryptographique E-Signature SHA-256.
          </p>
        </div>

        {/* 6. Éléments manquants ajoutés */}
        <div className="bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-500/30 space-y-1.5">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            6. Enrichissements Apportés à la Narration
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li><strong>Audit Trail Immuable :</strong> Journalisation SHA-256 avec adresse IP et horodatage de chaque opération.</li>
            <li><strong>Simulateur d'Intrusion Interactif :</strong> Permet de tester en direct le verrouillage de compte et la génération du procès-verbal de convocation.</li>
            <li><strong>Sélecteur Rapide de Rôle (Impersonation) :</strong> Permet de basculer en un clic entre DG, Chef Dépt, Directeur, Chef Division, Chef Service et Agent pour vérifier l'étanchéité des vues.</li>
            <li><strong>Architecture & Migrations Laravel 11/12 :</strong> Code source complet des migrations, modèles Eloquent récursifs, middlewares et policies d'autorisation.</li>
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl"
          >
            J'ai Compris
          </button>
        </div>
      </div>
    </div>
  );
};
