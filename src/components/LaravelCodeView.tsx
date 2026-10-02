import React, { useState } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  Database, 
  ShieldCheck, 
  Layers, 
  BookOpen,
  Terminal,
  Server,
  Calculator,
  Coins
} from 'lucide-react';
import { laravelPayrollSnippets } from '../data/laravelPayrollSnippets';

export type LaravelCodeTab = 
  | 'payroll_service' 
  | 'payroll_migrations' 
  | 'payroll_controller' 
  | 'payroll_models'
  | 'migrations' 
  | 'models' 
  | 'middleware' 
  | 'policies' 
  | 'architecture';

export const LaravelCodeView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LaravelCodeTab>('payroll_service');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const codeSnippets: Record<LaravelCodeTab, string> = {
    payroll_service: laravelPayrollSnippets.payroll_service,
    payroll_migrations: laravelPayrollSnippets.payroll_migrations,
    payroll_controller: laravelPayrollSnippets.payroll_controller,
    payroll_models: laravelPayrollSnippets.payroll_models,
    migrations: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Organisations (Entreprise, Etablissement, ONG)
        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->enum('type', ['entreprise', 'etablissement', 'ong']);
            $table->string('registration_number')->unique();
            $table->string('headquarters');
            $table->string('email');
            $table->string('phone');
            $table->boolean('has_departements')->default(true);
            $table->boolean('has_directions')->default(true);
            $table->boolean('has_divisions')->default(true);
            $table->boolean('has_services')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // 2. Entités Hiérarchiques (Département, Direction, Division, Service)
        Schema::create('hierarchical_entities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('parent_id')->nullable()->constrained('hierarchical_entities')->nullOnDelete();
            $table->string('name');
            $table->string('code')->unique();
            $table->enum('level', ['departement', 'direction', 'division', 'service']);
            $table->string('manager_name')->nullable();
            $table->string('manager_email')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // 3. Utilisateurs & Habilitations RBAC
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('departement_id')->nullable()->constrained('hierarchical_entities');
            $table->foreignUuid('direction_id')->nullable()->constrained('hierarchical_entities');
            $table->foreignUuid('division_id')->nullable()->constrained('hierarchical_entities');
            $table->foreignUuid('service_id')->nullable()->constrained('hierarchical_entities');
            
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent']);
            $table->string('role_title');
            $table->enum('status', ['actif', 'verrouille', 'convoque'])->default('actif');
            $table->unsignedTinyInteger('failed_access_attempts')->default(0);
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        // 4. Documents & Pièces en Workflow (Financier, Logistique, RH)
        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('author_id')->constrained('users');
            $table->foreignUuid('target_entity_id')->nullable()->constrained('hierarchical_entities');
            $table->foreignUuid('target_user_id')->nullable()->constrained('users'); // Pour Bulletin de paie confidentiel
            
            $table->string('reference_number')->unique();
            $table->string('title');
            $table->enum('category', ['financier_comptable', 'chaine_logistique_commerciale', 'ressources_humaines']);
            $table->string('subtype'); // facture, devis, bulletin_de_paie...
            $table->boolean('is_confidential_payslip')->default(false);
            $table->decimal('amount', 18, 2)->nullable();
            $table->string('currency', 10)->default('FCFA');
            $table->enum('status', ['brouillon', 'en_revue', 'approuve', 'signe', 'rejete'])->default('en_revue');
            $table->json('permissions_matrix'); // viewRoles, editRoles, validateRoles, signRoles
            $table->json('electronic_signature')->nullable(); // signer, hash, timestamp
            $table->timestamps();
        });

        // 5. Alertes d'Intrusion & Sécurité
        Schema::create('security_alerts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained();
            $table->foreignUuid('target_entity_id')->constrained('hierarchical_entities');
            $table->unsignedTinyInteger('attempt_count');
            $table->enum('status', ['alerte_emise', 'compte_verrouille', 'convocation_programmee', 'resolue']);
            $table->string('ip_address');
            $table->text('reason');
            $table->json('convocation_notice')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_alerts');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('users');
        Schema::dropIfExists('hierarchical_entities');
        Schema::dropIfExists('organizations');
    }
};`,

    models: `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;
use Illuminate\\Database\\Eloquent\\Concerns\\HasUuids;

class HierarchicalEntity extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id', 'parent_id', 'name', 'code', 'level', 'manager_name', 'manager_email', 'description'
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(HierarchicalEntity::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(HierarchicalEntity::class, 'parent_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'service_id');
    }

    public function isAncestorOf(HierarchicalEntity $entity): boolean
    {
        $current = $entity->parent;
        while ($current) {
            if ($current->id === $this->id) {
                return true;
            }
            $current = $current->parent;
        }
        return false;
    }
}

// User Model with Hierarchy Evaluation
class User extends Authenticatable
{
    use HasUuids;

    public function isSuperUser(): bool
    {
        return $this->role === 'dg';
    }

    public function canAccessEntity(HierarchicalEntity $target): bool
    {
        if ($this->isSuperUser()) return true;

        if ($this->role === 'chef_departement') {
            return $this->departement_id === $target->id || 
                   HierarchicalEntity::find($this->departement_id)?->isAncestorOf($target);
        }

        if ($this->role === 'directeur') {
            return $this->direction_id === $target->id || 
                   HierarchicalEntity::find($this->direction_id)?->isAncestorOf($target);
        }

        if ($this->role === 'chef_division') {
            return $this->division_id === $target->id || 
                   HierarchicalEntity::find($this->division_id)?->isAncestorOf($target);
        }

        return $this->service_id === $target->id;
    }
}`,

    middleware: `<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use App\\Models\\SecurityAlert;
use App\\Notifications\\IntrusionAlertNotification;
use Illuminate\\Support\\Facades\\Notification;

class CheckEntityHierarchyAccess
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        // 1. Bloquer immédiatement si compte verrouillé
        if ($user->status === 'verrouille') {
            return response()->json([
                'error' => 'Compte verrouillé pour raison disciplinaire suite à des intrusions répétées.'
            ], 403);
        }

        $targetEntityId = $request->route('entityId') ?? $request->input('entity_id');
        if (!$targetEntityId) {
            return $next($request);
        }

        $targetEntity = \\App\\Models\\HierarchicalEntity::findOrFail($targetEntityId);

        // 2. Vérifier l'habilitation hiérarchique
        if (!$user->canAccessEntity($targetEntity)) {
            $user->increment('failed_access_attempts');

            $isLocked = false;
            $status = 'alerte_emise';

            // Règle d'insistance : verrouillage et convocation
            if ($user->failed_access_attempts >= 3) {
                $user->update(['status' => 'verrouille']);
                $isLocked = true;
                $status = 'compte_verrouille';
            }

            // Déclencher l'alerte de sécurité
            $alert = SecurityAlert::create([
                'user_id' => $user->id,
                'target_entity_id' => $targetEntity->id,
                'attempt_count' => $user->failed_access_attempts,
                'status' => $status,
                'ip_address' => $request->ip(),
                'reason' => "Tentative d'accès illégitime à {$targetEntity->name} hors périmètre hiérarchique.",
                'convocation_notice' => $isLocked ? [
                    'summon_date' => now()->addDays(2)->format('Y-m-d H:i'),
                    'location' => 'Direction Générale - Commission de Sécurité',
                    'panel_members' => ['DG', 'DRH', 'Responsable Sécurité SI'],
                ] : null,
            ]);

            // Notification envoyée au DG et au responsable de l'entité cible
            $dg = \\App\\Models\\User::where('role', 'dg')->first();
            Notification::send([$dg], new IntrusionAlertNotification($alert));

            return response()->json([
                'error' => "Accès refusé. Alerte de sécurité transmise au DG et au responsable de {$targetEntity->name}.",
                'attempts' => $user->failed_access_attempts,
                'account_locked' => $isLocked
            ], 403);
        }

        return $next($request);
    }
}`,

    policies: `<?php

namespace App\\Policies;

use App\\Models\\Document;
use App\\Models\\User;

class DocumentPolicy
{
    /**
     * Contrôle d'accès strict à la consultation d'une pièce
     */
    public function view(User $user, Document $document): bool
    {
        if ($user->status === 'verrouille') {
            return false;
        }

        // 1. RÈGLE STRICTE BULLETIN DE PAIE :
        // Seuls l'agent lui-même, le DRH et le service de paie peuvent voir son bulletin
        if ($document->subtype === 'bulletin_de_paie' || $document->is_confidential_payslip) {
            $isOwnerAgent = $document->target_user_id === $user->id;
            $isDRH = ($user->role === 'directeur' && $user->direction?->code === 'DIR-RH');
            $isServicePaie = ($user->service?->code === 'SRV-PAIE');
            $isDG = $user->role === 'dg';

            return $isOwnerAgent || $isDRH || $isServicePaie || $isDG;
        }

        // 2. Haute Hiérarchie (DG/PDG/DGA) : voit TOUT
        if ($user->role === 'dg') {
            return true;
        }

        // 3. Auteur du document
        if ($document->author_id === $user->id) {
            return true;
        }

        // 4. Vérification de périmètre par entité
        if ($document->target_entity_id) {
            return $user->canAccessEntity($document->targetEntity);
        }

        return in_array($user->role, $document->permissions_matrix['viewRoles'] ?? []);
    }

    /**
     * Droit d'apposer la signature électronique certifiée
     */
    public function sign(User $user, Document $document): bool
    {
        if ($user->status === 'verrouille' || $user->role === 'agent') {
            return false;
        }

        return in_array($user->role, $document->permissions_matrix['signRoles'] ?? []);
    }
}`,

    architecture: `# Architecture Globale Laravel 11/12 Enterprise

## 1. Structure Recommandée du Projet
\`\`\`
app/
├── Models/
│   ├── Organization.php
│   ├── HierarchicalEntity.php
│   ├── User.php
│   ├── Document.php
│   ├── WorkflowTask.php
│   └── SecurityAlert.php
├── Http/
│   ├── Middleware/
│   │   ├── CheckEntityHierarchyAccess.php
│   │   └── EnsureAccountNotLocked.php
│   ├── Controllers/
│   │   ├── OrganizationController.php
│   │   ├── DocumentWorkflowController.php
│   │   └── SecurityIncidentController.php
├── Policies/
│   ├── DocumentPolicy.php
│   └── WorkflowTaskPolicy.php
└── Services/
    ├── DigitalSignatureService.php (Génération SHA-256 + Cachet RFC 3161)
    └── HierarchyScopingService.php (Calcul de visibilité récursive)
\`\`\`

## 2. Déploiement & Configuration
- **Filament Admin Panel** : Compatible avec Filament v3 pour les panels hiérarchiques par département.
- **Inertia.js + Vue / React** : Intégration front-end réactive.
- **Queues & Notifications** : Notification instantanée via Mail / SMS / WebPush aux DG et chefs d'entités lors d'une tentative d'intrusion.
- **Stockage S3 / MinIO Sécurisé** : Bulletins de paie chiffrés AES-256 avec URLs pré-signées éphémères (TTL 60s).`
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
              Backend Laravel 11/12 Eloquent & Policies
            </span>
            <span className="text-xs text-slate-400">Prêt pour Production</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">
            Architecture & Spécifications Techniques Laravel
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Code complet des Migrations de base de données, Modèles Eloquent avec relations hiérarchiques récursives, Middlewares de détection d'intrusion et Policies de cloisonnement RH.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopy(codeSnippets[activeTab], activeTab)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all"
          >
            {copiedKey === activeTab ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey === activeTab ? 'Copié !' : 'Copier le Code'}</span>
          </button>
        </div>
      </div>

      {/* Code Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('payroll_service')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'payroll_service'
              ? 'bg-emerald-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-emerald-300" />
          1. Moteur de Calcul Paie & IPR RDC
        </button>

        <button
          onClick={() => setActiveTab('payroll_migrations')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'payroll_migrations'
              ? 'bg-emerald-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-300" />
          2. Migrations Schéma RH & Paie
        </button>

        <button
          onClick={() => setActiveTab('payroll_controller')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'payroll_controller'
              ? 'bg-emerald-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-emerald-300" />
          3. Contrôleur Paie & Virements
        </button>

        <button
          onClick={() => setActiveTab('payroll_models')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'payroll_models'
              ? 'bg-emerald-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-300" />
          4. Modèles Eloquent RH
        </button>

        <button
          onClick={() => setActiveTab('migrations')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'migrations'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          5. Migrations Organisation & RBAC
        </button>

        <button
          onClick={() => setActiveTab('models')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'models'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          6. Modèles Hiérarchie
        </button>

        <button
          onClick={() => setActiveTab('middleware')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'middleware'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          7. Middleware Anti-Intrusion
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'policies'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          8. Policies (Confidentialité RH)
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'architecture'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          9. Blueprint & Déploiement
        </button>
      </div>

      {/* Code Display Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-slate-300">
              {activeTab === 'payroll_service' && 'app/Services/DRCPayrollCalculationService.php'}
              {activeTab === 'payroll_migrations' && 'database/migrations/2026_create_drc_payroll_and_hr_tables.php'}
              {activeTab === 'payroll_controller' && 'app/Http/Controllers/PayrollController.php'}
              {activeTab === 'payroll_models' && 'app/Models/EmployeeContract.php & PayrollRun.php & Payslip.php'}
              {activeTab === 'migrations' && 'database/migrations/2026_create_org_workflow_tables.php'}
              {activeTab === 'models' && 'app/Models/HierarchicalEntity.php & User.php'}
              {activeTab === 'middleware' && 'app/Http/Middleware/CheckEntityHierarchyAccess.php'}
              {activeTab === 'policies' && 'app/Policies/DocumentPolicy.php'}
              {activeTab === 'architecture' && 'ARCHITECTURE_GUIDE.md'}
            </span>
          </div>

          <button
            onClick={() => handleCopy(codeSnippets[activeTab], activeTab)}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
          >
            {copiedKey === activeTab ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedKey === activeTab ? 'Copié' : 'Copier'}
          </button>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[600px]">
          {codeSnippets[activeTab]}
        </pre>
      </div>
    </div>
  );
};
