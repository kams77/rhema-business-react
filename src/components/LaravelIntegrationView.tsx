// src/components/LaravelIntegrationView.tsx
// Onglet « Laravel » : extraits de code backend (modèles Eloquent, policies, migrations).
import React, { useState } from 'react';
import { Check, Copy, FileCode2, Terminal } from 'lucide-react';

export const LaravelIntegrationView: React.FC = () => {
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedCodeSnippet(id);
        setTimeout(() => setCopiedCodeSnippet(null), 2500);
      },
      () => setCopiedCodeSnippet(null)
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-indigo-400" />
              Architecture Backend Laravel 11/12 & Eloquent
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Code complet prêt à l'emploi : modèles Eloquent, relations, politiques de sécurité (Policies) et migrations SQL PostgreSQL.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" /> PHP 8.3+ / Laravel 11
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {/* Commande artisan */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>1. Génération des Modèles & Migrations :</span>
              <button
                onClick={() => copyToClipboard('php artisan make:model HierarchicalEntity -mcr\nphp artisan make:model Organization -mcr\nphp artisan make:model DocumentItem -mcr\nphp artisan make:model PayrollRun -mcr\nphp artisan make:policy HierarchicalAccessPolicy', 'artisan')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copiedCodeSnippet === 'artisan' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeSnippet === 'artisan' ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
{`php artisan make:model HierarchicalEntity -mcr
php artisan make:model Organization -mcr
php artisan make:model DocumentItem -mcr
php artisan make:model PayrollRun -mcr
php artisan make:policy HierarchicalAccessPolicy`}
            </pre>
          </div>

          {/* Modèle HierarchicalEntity */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>2. Modèle Eloquent Récursif (HierarchicalEntity.php) :</span>
              <button
                onClick={() => copyToClipboard(`namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class HierarchicalEntity extends Model
{
    protected $fillable = [
        'organization_id',
        'parent_id',
        'name',
        'code',
        'level', // departement, direction, division, service
        'manager_id',
        'agent_count'
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(HierarchicalEntity::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(HierarchicalEntity::class, 'parent_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}`, 'model')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copiedCodeSnippet === 'model' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeSnippet === 'model' ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class HierarchicalEntity extends Model
{
    protected $fillable = [
        'organization_id',
        'parent_id',
        'name',
        'code',
        'level', // departement, direction, division, service
        'manager_id',
        'agent_count'
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(HierarchicalEntity::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(HierarchicalEntity::class, 'parent_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}`}
            </pre>
          </div>

          {/* Policy RBAC */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>3. Policy de Cloisonnement Strict (DocumentPolicy.php) :</span>
              <button
                onClick={() => copyToClipboard(`namespace App\\Policies;

use App\\Models\\User;
use App\\Models\\DocumentItem;

class DocumentPolicy
{
    /**
     * Le DG a une vision transversale intégrale.
     * Pour les autres, accès uniquement si le document appartient à leur périmètre hiérarchique.
     */
    public function view(User $user, DocumentItem $document): bool
    {
        if ($user->role === 'dg') {
            return true;
        }

        // Bulletin de paie strictement confidentiel
        if ($document->is_confidential_payslip) {
            return $document->target_user_id === $user->id || $user->direction_id === 'dir-rh';
        }

        // Cloisonnement de service
        return $user->service_id === $document->target_entity_id 
            || $user->direction_id === $document->target_entity_id
            || $user->departement_id === $document->target_entity_id;
    }
}`, 'policy')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copiedCodeSnippet === 'policy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeSnippet === 'policy' ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`namespace App\\Policies;

use App\\Models\\User;
use App\\Models\\DocumentItem;

class DocumentPolicy
{
    public function view(User $user, DocumentItem $document): bool
    {
        if ($user->role === 'dg') {
            return true;
        }

        if ($document->is_confidential_payslip) {
            return $document->target_user_id === $user->id || $user->direction_id === 'dir-rh';
        }

        return $user->service_id === $document->target_entity_id 
            || $user->direction_id === $document->target_entity_id
            || $user->departement_id === $document->target_entity_id;
    }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
