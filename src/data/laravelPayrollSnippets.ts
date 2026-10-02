/**
 * Code Laravel 11/12 Enterprise - Module de Paie & RH Spécifique RDC
 * Conforme au Code du Travail (Loi n° 015/2002) et Barème Fiscal IPR DGI
 */

export const laravelPayrollSnippets = {
  payroll_service: `<?php

namespace App\\Services;

use App\\Models\\User;
use App\\Models\\EmployeeContract;
use App\\Models\\OvertimeRecord;
use App\\Models\\SalaryAdvance;
use App\\Models\\Payslip;
use Carbon\\Carbon;
use Illuminate\\Support\\Facades\\Hash;

class DRCPayrollCalculationService
{
    /**
     * Taux légaux officiels RDC
     */
    public const CNSS_EMPLOYEE_RATE = 0.05;   // 5% retenue à la source salarié
    public const CNSS_EMPLOYER_RATE = 0.13;   // 13% charge patronale
    public const INPP_RATE          = 0.03;   // 3% Institut National de Préparation Professionnelle
    public const ONEM_RATE          = 0.002;  // 0.2% Office National de l'Emploi
    public const LEGAL_MONTHLY_HOURS= 173.33; // 40h / semaine légales

    /**
     * Calcule le bulletin de paie mensuel complet d'un salarié
     *
     * @param EmployeeContract $contract
     * @param string $month (YYYY-MM)
     * @param float $exchangeRateUSD_CDF (Taux de la Banque Centrale du Congo)
     * @return array
     */
    public function calculateMonthlyPayslip(
        EmployeeContract $contract,
        string $month,
        float $exchangeRateUSD_CDF = 2850.00
    ): array {
        $currency = $contract->salary_currency; // 'USD' ou 'CDF'
        $baseSalary = (float) $contract->base_salary;

        // 1. Calcul des Heures Supplémentaires (Code du Travail RDC Art. 119)
        $hourlyRate = $baseSalary / self::LEGAL_MONTHLY_HOURS;
        $overtimes = OvertimeRecord::where('user_id', $contract->user_id)
            ->where('payroll_month', $month)
            ->where('status', 'valide')
            ->get();

        $dayOtHours     = $overtimes->sum('day_hours');
        $nightOtHours   = $overtimes->sum('night_hours');
        $weekendOtHours = $overtimes->sum('weekend_holiday_hours');

        // Majorations légales : +30% jour, +60% nuit, +100% dimanches et fériés
        $otPayDay     = $dayOtHours * ($hourlyRate * 1.30);
        $otPayNight   = $nightOtHours * ($hourlyRate * 1.60);
        $otPayWeekend = $weekendOtHours * ($hourlyRate * 2.00);
        $totalOvertimePay = round($otPayDay + $otPayNight + $otPayWeekend, 2);

        // 2. Primes & Indemnités conventionnelles
        $transportAllowance = round($baseSalary * 0.10, 2); // 10% indemnité transport
        $housingAllowance   = round($baseSalary * 0.05, 2); // 5% indemnité logement
        $totalAllowances    = $transportAllowance + $housingAllowance;

        // 3. Salaire Brut Imposable
        $grossSalary = $baseSalary + $totalOvertimePay + $totalAllowances;

        // 4. Cotisation CNSS Salarié (5%)
        $cnssEmployee = round($grossSalary * self::CNSS_EMPLOYEE_RATE, 2);

        // 5. Assiette Fiscale IPR (Salaire Brut - Cotisation CNSS Salarié)
        $taxableIprBase = $grossSalary - $cnssEmployee;

        // 6. Calcul de l'IPR selon le barème progressif officiel DGI (Loi de Finances)
        $iprDeduction = $this->calculateIPR(
            $taxableIprBase,
            $currency,
            $contract->dependents_count,
            $exchangeRateUSD_CDF
        );

        // 7. Retenue Avance sur Salaire / Acompte
        $advances = SalaryAdvance::where('user_id', $contract->user_id)
            ->where('repayment_month', $month)
            ->where('status', 'valide_rh')
            ->where('deducted_from_payroll', false)
            ->get();

        $totalAdvanceDeduction = 0.0;
        foreach ($advances as $adv) {
            $advAmount = (float) $adv->amount;
            if ($adv->currency !== $currency) {
                $advAmount = ($currency === 'CDF')
                    ? $advAmount * $exchangeRateUSD_CDF
                    : $advAmount / $exchangeRateUSD_CDF;
            }
            $totalAdvanceDeduction += $advAmount;
        }

        // 8. Salaire Net à Verser
        $netToPay = max(0, $grossSalary - $cnssEmployee - $iprDeduction - $totalAdvanceDeduction);

        // 9. Charges Patronales RDC
        $cnssEmployer = round($grossSalary * self::CNSS_EMPLOYER_RATE, 2);
        $inppEmployer = round($grossSalary * self::INPP_RATE, 2);
        $onemEmployer = round($grossSalary * self::ONEM_RATE, 2);
        $totalEmployerCost = round($grossSalary + $cnssEmployer + $inppEmployer + $onemEmployer, 2);

        // 10. Conversion Bi-Devise Référentielle (USD <-> CDF)
        $convertedNet = ($currency === 'USD')
            ? round($netToPay * $exchangeRateUSD_CDF, 0)
            : round($netToPay / $exchangeRateUSD_CDF, 2);

        // 11. Scellé Cryptographique SHA-256 Inaltérable
        $referenceNumber = 'PAY-' . strtoupper(substr($month, 0, 7)) . '-' . $contract->matricule;
        $hashSignature = hash('sha256', implode('|', [
            $referenceNumber,
            $contract->user_id,
            $netToPay,
            $currency,
            $month,
            config('app.key')
        ]));

        return [
            'reference_number'        => $referenceNumber,
            'contract_id'             => $contract->id,
            'user_id'                 => $contract->user_id,
            'matricule'               => $contract->matricule,
            'month'                   => $month,
            'currency'                => $currency,
            'exchange_rate_applied'   => $exchangeRateUSD_CDF,
            'base_salary'             => $baseSalary,
            'overtime_pay'            => $totalOvertimePay,
            'allowances_total'        => $totalAllowances,
            'gross_salary'            => $grossSalary,
            'cnss_employee_5pct'      => $cnssEmployee,
            'taxable_ipr_base'        => $taxableIprBase,
            'ipr_dgi_deduction'       => $iprDeduction,
            'advance_deduction'       => $totalAdvanceDeduction,
            'net_to_pay'              => round($netToPay, 2),
            'converted_net_opposite'  => $convertedNet,
            'cnss_employer_13pct'     => $cnssEmployer,
            'inpp_employer_3pct'      => $inppEmployer,
            'onem_employer_0_2pct'    => $onemEmployer,
            'total_employer_cost'     => $totalEmployerCost,
            'signature_hash'          => $hashSignature,
            'signed_at'               => now()->toIso8601String(),
        ];
    }

    /**
     * Barème progressif officiel IPR DGI RDC (Art. 84 Loi de Finances)
     * Tranches annuelles ramenées au mois en CDF, avec réduction pour charges de famille
     */
    public function calculateIPR(
        float $taxableBase,
        string $currency,
        int $dependentsCount,
        float $exchangeRate
    ): float {
        // Normaliser l'assiette en Francs Congolais (CDF)
        $baseCDF = ($currency === 'USD') ? $taxableBase * $exchangeRate : $taxableBase;

        // Tranches mensuelles officielles DGI en CDF
        $brackets = [
            ['limit' => 162000,  'rate' => 0.03],  // 0 à 162 000 CDF -> 3%
            ['limit' => 324000,  'rate' => 0.15],  // 162 001 à 324 000 CDF -> 15%
            ['limit' => 648000,  'rate' => 0.30],  // 324 001 à 648 000 CDF -> 30%
            ['limit' => INF,     'rate' => 0.40],  // Au-delà de 648 000 CDF -> 40%
        ];

        $taxCDF = 0.0;
        $prevLimit = 0.0;

        foreach ($brackets as $b) {
            if ($baseCDF > $prevLimit) {
                $taxableChunk = min($baseCDF - $prevLimit, $b['limit'] - $prevLimit);
                $taxCDF += $taxableChunk * $b['rate'];
                $prevLimit = $b['limit'];
            } else {
                break;
            }
        }

        // Réduction légale pour personnes à charge (2% par enfant, max 9 personnes = 18%)
        $effectiveDependents = min(max($dependentsCount, 0), 9);
        $familyDiscount = $taxCDF * ($effectiveDependents * 0.02);
        $finalTaxCDF = max(0, $taxCDF - $familyDiscount);

        // Reconvertir si le salaire est stipulé en USD
        return ($currency === 'USD')
            ? round($finalTaxCDF / $exchangeRate, 2)
            : round($finalTaxCDF, 0);
    }
}
`,

  payroll_migrations: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Schéma de Base de Données RH & Paie RDC (MySQL / PostgreSQL / SQLite)
     */
    public function up(): void
    {
        // 1. Fiche Salarié & Contrat de Travail (Code du Travail RDC)
        Schema::create('employee_contracts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('employee_code')->unique(); // Ex: RH-2026-088
            $table->string('matricule')->unique();     // Ex: MAT-001-RB
            $table->enum('contract_type', ['CDI', 'CDD', 'Stage', 'Consultant', 'Journalier'])->default('CDI');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->decimal('base_salary', 15, 2);
            $table->enum('salary_currency', ['USD', 'CDF'])->default('USD');
            $table->string('category_pro');            // Ex: Cadre Supérieur VSAT
            $table->string('echelon');                 // Ex: Catégorie 6 / Échelon 1
            $table->string('cnss_number')->nullable(); // N° Affiliation CNSS RDC
            $table->boolean('inpp_registered')->default(true);
            $table->boolean('onem_registered')->default(true);
            $table->enum('payment_mode', ['virement', 'mobile_money', 'cheque', 'especes'])->default('virement');
            $table->string('bank_name')->default('Rawbank Kinshasa');
            $table->string('bank_account_number')->nullable();
            $table->string('mobile_money_number')->nullable();
            $table->unsignedTinyInteger('dependents_count')->default(2);
            $table->enum('marital_status', ['celibataire', 'marie', 'divorce', 'veuf'])->default('marie');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // 2. Heures Supplémentaires (Loi RDC Art. 119)
        Schema::create('overtime_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('work_date');
            $table->decimal('day_hours', 5, 2)->default(0);             // Majoration +30%
            $table->decimal('night_hours', 5, 2)->default(0);           // Majoration +60%
            $table->decimal('weekend_holiday_hours', 5, 2)->default(0); // Majoration +100%
            $table->decimal('calculated_pay_usd', 12, 2)->default(0);
            $table->decimal('calculated_pay_cdf', 15, 2)->default(0);
            $table->string('reason');
            $table->string('payroll_month', 7); // Ex: 2026-09
            $table->enum('status', ['en_attente', 'valide', 'rejete'])->default('valide');
            $table->string('approved_by')->nullable();
            $table->timestamps();
        });

        // 3. Congés & Titres de Sortie (Droit légal 24 jours)
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['conge_annuel', 'maladie', 'circonstance', 'maternite', 'sans_solde']);
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedSmallInteger('duration_days');
            $table->text('reason')->nullable();
            $table->enum('status', ['en_attente', 'approuve', 'rejete'])->default('en_attente');
            $table->string('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        // 4. Avances sur Salaire & Acomptes Programmés
        Schema::create('salary_advances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->enum('currency', ['USD', 'CDF'])->default('USD');
            $table->date('request_date');
            $table->string('repayment_month', 7); // Ex: 2026-10
            $table->string('reason');
            $table->enum('status', ['en_attente', 'valide_rh', 'rejete'])->default('valide_rh');
            $table->boolean('deducted_from_payroll')->default(false);
            $table->timestamps();
        });

        // 5. Registre Disciplinaire & Sanctions (Loi n° 015/2002)
        Schema::create('disciplinary_actions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reference_number')->unique();
            $table->date('action_date');
            $table->date('incident_date');
            $table->enum('type', ['demande_explication', 'avertissement', 'blame', 'mise_a_pied', 'licenciement']);
            $table->text('reason');
            $table->text('explanation_provided')->nullable();
            $table->unsignedTinyInteger('sanction_duration_days')->nullable(); // Max 3 jours mise à pied
            $table->enum('status', ['en_attente_reponse', 'sanction_appliquee', 'classe_sans_suite'])->default('sanction_appliquee');
            $table->string('issued_by');
            $table->timestamps();
        });

        // 6. Clôture de Paie Mensuelle Consolidée (Payroll Run Period)
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('month', 7)->unique(); // Ex: 2026-09
            $table->decimal('exchange_rate_usd_cdf', 10, 4); // Ex: 2850.00
            $table->decimal('total_gross_base', 18, 2);
            $table->decimal('total_overtime_pay', 18, 2)->default(0);
            $table->decimal('total_allowances', 18, 2)->default(0);
            $table->decimal('total_gross_salary', 18, 2);
            $table->decimal('total_cnss_employee', 18, 2); // 5%
            $table->decimal('total_cnss_employer', 18, 2); // 13%
            $table->decimal('total_ipr_tax', 18, 2);       // IPR DGI
            $table->decimal('total_inpp_tax', 18, 2);      // INPP 3%
            $table->decimal('total_onem_tax', 18, 2);      // ONEM 0.2%
            $table->decimal('total_advances_deducted', 18, 2)->default(0);
            $table->decimal('total_net_salary', 18, 2);
            $table->enum('status', ['brouillon', 'valide_rh', 'cloture_dg'])->default('brouillon');
            $table->string('validated_by_dg')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->string('closure_hash')->nullable(); // Empreinte SHA-256
            $table->timestamps();
        });

        // 7. Bulletins de Paie Individuels Scellés
        Schema::create('payslips', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reference_number')->unique();
            $table->decimal('base_salary', 15, 2);
            $table->decimal('overtime_pay', 15, 2)->default(0);
            $table->decimal('allowances_total', 15, 2)->default(0);
            $table->decimal('gross_salary', 15, 2);
            $table->decimal('cnss_employee_5pct', 15, 2);
            $table->decimal('taxable_ipr_base', 15, 2);
            $table->decimal('ipr_dgi_deduction', 15, 2);
            $table->decimal('advance_deduction', 15, 2)->default(0);
            $table->decimal('net_to_pay', 15, 2);
            $table->enum('currency', ['USD', 'CDF'])->default('USD');
            $table->decimal('converted_net_opposite_currency', 18, 2);
            $table->string('signature_hash');
            $table->timestamp('signed_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('disciplinary_actions');
        Schema::dropIfExists('salary_advances');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('overtime_records');
        Schema::dropIfExists('employee_contracts');
    }
};
`,

  payroll_controller: `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;
use App\\Models\\PayrollRun;
use App\\Models\\EmployeeContract;
use App\\Models\\Payslip;
use App\\Services\\DRCPayrollCalculationService;
use Illuminate\\Support\\Facades\\DB;
use Symfony\\Component\\HttpFoundation\\StreamedResponse;

class PayrollController extends Controller
{
    protected DRCPayrollCalculationService $payrollService;

    public function __construct(DRCPayrollCalculationService $payrollService)
    {
        $this->payrollService = $payrollService;
    }

    /**
     * Génère la clôture mensuelle et les bulletins de l'ensemble du personnel
     */
    public function generateMonthlyRun(Request $request)
    {
        $request->validate([
            'month'                 => 'required|regex:/^\\d{4}-\\d{2}$/',
            'exchange_rate_usd_cdf' => 'required|numeric|min:1000'
        ]);

        $month = $request->input('month');
        $rate  = (float) $request->input('exchange_rate_usd_cdf');

        return DB::transaction(function () use ($month, $rate) {
            $contracts = EmployeeContract::where('active', true)->get();

            $run = PayrollRun::updateOrCreate(
                ['month' => $month],
                [
                    'exchange_rate_usd_cdf'   => $rate,
                    'total_gross_base'        => 0,
                    'total_overtime_pay'      => 0,
                    'total_allowances'        => 0,
                    'total_gross_salary'      => 0,
                    'total_cnss_employee'     => 0,
                    'total_cnss_employer'     => 0,
                    'total_ipr_tax'           => 0,
                    'total_inpp_tax'          => 0,
                    'total_onem_tax'          => 0,
                    'total_advances_deducted' => 0,
                    'total_net_salary'        => 0,
                    'status'                  => 'valide_rh',
                ]
            );

            // Supprimer les anciens bulletins en cours de révision
            Payslip::where('payroll_run_id', $run->id)->delete();

            $totals = [
                'base' => 0.0, 'ot' => 0.0, 'allowances' => 0.0, 'gross' => 0.0,
                'cnss_emp' => 0.0, 'cnss_pat' => 0.0, 'ipr' => 0.0,
                'inpp' => 0.0, 'onem' => 0.0, 'advances' => 0.0, 'net' => 0.0
            ];

            foreach ($contracts as $contract) {
                $slipData = $this->payrollService->calculateMonthlyPayslip($contract, $month, $rate);

                // Normaliser les totaux de clôture en USD de référence
                $multiplier = ($contract->salary_currency === 'CDF') ? (1.0 / $rate) : 1.0;

                $totals['base']       += $slipData['base_salary'] * $multiplier;
                $totals['ot']         += $slipData['overtime_pay'] * $multiplier;
                $totals['allowances'] += $slipData['allowances_total'] * $multiplier;
                $totals['gross']      += $slipData['gross_salary'] * $multiplier;
                $totals['cnss_emp']   += $slipData['cnss_employee_5pct'] * $multiplier;
                $totals['cnss_pat']   += $slipData['cnss_employer_13pct'] * $multiplier;
                $totals['ipr']        += $slipData['ipr_dgi_deduction'] * $multiplier;
                $totals['inpp']       += $slipData['inpp_employer_3pct'] * $multiplier;
                $totals['onem']       += $slipData['onem_employer_0_2pct'] * $multiplier;
                $totals['advances']   += $slipData['advance_deduction'] * $multiplier;
                $totals['net']        += $slipData['net_to_pay'] * $multiplier;

                Payslip::create([
                    'payroll_run_id'                  => $run->id,
                    'user_id'                         => $contract->user_id,
                    'reference_number'                => $slipData['reference_number'],
                    'base_salary'                     => $slipData['base_salary'],
                    'overtime_pay'                    => $slipData['overtime_pay'],
                    'allowances_total'                => $slipData['allowances_total'],
                    'gross_salary'                    => $slipData['gross_salary'],
                    'cnss_employee_5pct'              => $slipData['cnss_employee_5pct'],
                    'taxable_ipr_base'                => $slipData['taxable_ipr_base'],
                    'ipr_dgi_deduction'               => $slipData['ipr_dgi_deduction'],
                    'advance_deduction'               => $slipData['advance_deduction'],
                    'net_to_pay'                      => $slipData['net_to_pay'],
                    'currency'                        => $slipData['currency'],
                    'converted_net_opposite_currency' => $slipData['converted_net_opposite'],
                    'signature_hash'                  => $slipData['signature_hash'],
                    'signed_at'                       => now(),
                ]);
            }

            $run->update([
                'total_gross_base'        => round($totals['base'], 2),
                'total_overtime_pay'      => round($totals['ot'], 2),
                'total_allowances'        => round($totals['allowances'], 2),
                'total_gross_salary'      => round($totals['gross'], 2),
                'total_cnss_employee'     => round($totals['cnss_emp'], 2),
                'total_cnss_employer'     => round($totals['cnss_pat'], 2),
                'total_ipr_tax'           => round($totals['ipr'], 2),
                'total_inpp_tax'          => round($totals['inpp'], 2),
                'total_onem_tax'          => round($totals['onem'], 2),
                'total_advances_deducted' => round($totals['advances'], 2),
                'total_net_salary'        => round($totals['net'], 2),
            ]);

            return response()->json([
                'message' => "Journal de paie du mois {$month} généré avec succès.",
                'run'     => $run->load('payslips.user')
            ]);
        });
    }

    /**
     * Exportation du Fichier de Virement Bancaire (Rawbank / Equity BCDC / Mobile Money)
     */
    public function exportBankTransferFile(string $runId): StreamedResponse
    {
        $run = PayrollRun::with('payslips.user.contract')->findOrFail($runId);

        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"BORDEREAU_VIREMENTS_{$run->month}.csv\"",
        ];

        return response()->stream(function () use ($run) {
            $handle = fopen('php://output', 'w');
            // BOM UTF-8 pour Excel
            fprintf($handle, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($handle, [
                'Matricule',
                'Nom Collaborateur',
                'Banque/Opérateur',
                'N° Compte / Mobile Money',
                'Montant Net',
                'Devise',
                'Libellé Virement'
            ], ';');

            foreach ($run->payslips as $slip) {
                $user = $slip->user;
                $ctr  = $user->contract;

                fputcsv($handle, [
                    $ctr->matricule,
                    $user->name,
                    $ctr->bank_name,
                    $ctr->bank_account_number ?: $ctr->mobile_money_number,
                    number_format($slip->net_to_pay, 2, ',', ''),
                    $slip->currency,
                    "SALAIRE {$run->month} RHEMA BUSINESS SARL"
                ], ';');
            }

            fclose($handle);
        }, 200, $headers);
    }
}
`,

  payroll_models: `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Concerns\\HasUuids;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class EmployeeContract extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'employee_code', 'matricule', 'contract_type',
        'start_date', 'end_date', 'base_salary', 'salary_currency',
        'category_pro', 'echelon', 'cnss_number', 'inpp_registered',
        'onem_registered', 'payment_mode', 'bank_name',
        'bank_account_number', 'mobile_money_number',
        'dependents_count', 'marital_status', 'active'
    ];

    protected $casts = [
        'start_date'        => 'date',
        'end_date'          => 'date',
        'base_salary'       => 'decimal:2',
        'inpp_registered'   => 'boolean',
        'onem_registered'   => 'boolean',
        'active'            => 'boolean',
        'dependents_count'  => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

class PayrollRun extends Model
{
    use HasUuids;

    protected $fillable = [
        'month', 'exchange_rate_usd_cdf', 'total_gross_base',
        'total_overtime_pay', 'total_allowances', 'total_gross_salary',
        'total_cnss_employee', 'total_cnss_employer', 'total_ipr_tax',
        'total_inpp_tax', 'total_onem_tax', 'total_advances_deducted',
        'total_net_salary', 'status', 'validated_by_dg',
        'validated_at', 'closure_hash'
    ];

    protected $casts = [
        'exchange_rate_usd_cdf'   => 'decimal:4',
        'total_gross_salary'      => 'decimal:2',
        'total_net_salary'        => 'decimal:2',
        'validated_at'            => 'datetime',
    ];

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class);
    }
}

class Payslip extends Model
{
    use HasUuids;

    protected $fillable = [
        'payroll_run_id', 'user_id', 'reference_number', 'base_salary',
        'overtime_pay', 'allowances_total', 'gross_salary',
        'cnss_employee_5pct', 'taxable_ipr_base', 'ipr_dgi_deduction',
        'advance_deduction', 'net_to_pay', 'currency',
        'converted_net_opposite_currency', 'signature_hash', 'signed_at'
    ];

    protected $casts = [
        'base_salary'                     => 'decimal:2',
        'gross_salary'                    => 'decimal:2',
        'net_to_pay'                      => 'decimal:2',
        'converted_net_opposite_currency' => 'decimal:2',
        'signed_at'                       => 'datetime',
    ];

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

class OvertimeRecord extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'work_date', 'day_hours', 'night_hours',
        'weekend_holiday_hours', 'calculated_pay_usd',
        'calculated_pay_cdf', 'reason', 'payroll_month',
        'status', 'approved_by'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
`
};
