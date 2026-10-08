import{c,r as d,j as e,aY as m,an as a,aT as n}from"./index-C39tjGvC.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],p=c("terminal",u),h=()=>{const[t,i]=d.useState(null),s=(o,l)=>{var r;(r=navigator.clipboard)==null||r.writeText(o).then(()=>{i(l),setTimeout(()=>i(null),2500)},()=>i(null))};return e.jsx("div",{className:"space-y-6 max-w-5xl mx-auto",children:e.jsxs("div",{className:"bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5",children:[e.jsxs("div",{children:[e.jsxs("h3",{className:"text-xl font-bold text-white flex items-center gap-2",children:[e.jsx(m,{className:"w-5 h-5 text-indigo-400"}),"Architecture Backend Laravel 11/12 & Eloquent"]}),e.jsx("p",{className:"text-xs text-slate-400 mt-1",children:"Code complet prêt à l'emploi : modèles Eloquent, relations, politiques de sécurité (Policies) et migrations SQL PostgreSQL."})]}),e.jsxs("div",{className:"flex items-center gap-2 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold",children:[e.jsx(p,{className:"w-3.5 h-3.5 text-indigo-400"})," PHP 8.3+ / Laravel 11"]})]}),e.jsxs("div",{className:"mt-6 space-y-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between",children:[e.jsx("span",{children:"1. Génération des Modèles & Migrations :"}),e.jsxs("button",{onClick:()=>s(`php artisan make:model HierarchicalEntity -mcr
php artisan make:model Organization -mcr
php artisan make:model DocumentItem -mcr
php artisan make:model PayrollRun -mcr
php artisan make:policy HierarchicalAccessPolicy`,"artisan"),className:"text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1",children:[t==="artisan"?e.jsx(a,{className:"w-3.5 h-3.5 text-emerald-400"}):e.jsx(n,{className:"w-3.5 h-3.5"}),t==="artisan"?"Copié !":"Copier"]})]}),e.jsx("pre",{className:"bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto",children:`php artisan make:model HierarchicalEntity -mcr
php artisan make:model Organization -mcr
php artisan make:model DocumentItem -mcr
php artisan make:model PayrollRun -mcr
php artisan make:policy HierarchicalAccessPolicy`})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between",children:[e.jsx("span",{children:"2. Modèle Eloquent Récursif (HierarchicalEntity.php) :"}),e.jsxs("button",{onClick:()=>s(`namespace App\\Models;

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
}`,"model"),className:"text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1",children:[t==="model"?e.jsx(a,{className:"w-3.5 h-3.5 text-emerald-400"}):e.jsx(n,{className:"w-3.5 h-3.5"}),t==="model"?"Copié !":"Copier"]})]}),e.jsx("pre",{className:"bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed",children:`namespace App\\Models;

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
}`})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between",children:[e.jsx("span",{children:"3. Policy de Cloisonnement Strict (DocumentPolicy.php) :"}),e.jsxs("button",{onClick:()=>s(`namespace App\\Policies;

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
}`,"policy"),className:"text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1",children:[t==="policy"?e.jsx(a,{className:"w-3.5 h-3.5 text-emerald-400"}):e.jsx(n,{className:"w-3.5 h-3.5"}),t==="policy"?"Copié !":"Copier"]})]}),e.jsx("pre",{className:"bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed",children:`namespace App\\Policies;

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
}`})]})]})]})})};export{h as LaravelIntegrationView};
