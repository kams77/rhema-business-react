// src/components/ErrorBoundary.tsx
// Intercepte les erreurs d'affichage pour éviter l'écran blanc et proposer une sortie.
import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { resetAllData } from '../lib/storage';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** « section » : erreur limitée à un module ; « app » : toute l'application. */
  scope?: 'section' | 'app';
  /** Change de valeur pour réinitialiser l'erreur (ex. changement d'onglet). */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RHEMA] Erreur d\'affichage :', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleReset = () => {
    if (!window.confirm('Effacer toutes les données enregistrées dans ce navigateur et revenir aux données de démonstration ?')) return;
    resetAllData();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isApp = this.props.scope === 'app';

    return (
      <div
        role="alert"
        className={`${isApp ? 'min-h-screen flex items-center justify-center p-6 bg-slate-950' : 'py-12'} text-slate-100`}
      >
        <div className="max-w-lg w-full mx-auto bg-slate-900 border border-rose-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white">
                {isApp ? "L'application a rencontré un problème" : 'Ce module a rencontré un problème'}
              </h2>
              <p className="text-xs text-slate-400">Vos données enregistrées ne sont pas perdues.</p>
            </div>
          </div>

          <details className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <summary className="cursor-pointer text-slate-300">Détails techniques</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">{error.message}</pre>
          </details>

          <div className="flex flex-col sm:flex-row gap-2">
            {isApp ? (
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
              >
                Recharger la page
              </button>
            ) : (
              <>
                <button
                  onClick={() => this.setState({ error: null })}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                >
                  Réessayer
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold"
                >
                  Recharger la page
                </button>
              </>
            )}
          </div>

          {isApp && (
            <button
              onClick={this.handleReset}
              className="w-full py-2 rounded-xl text-rose-300 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Si le problème persiste : revenir aux données de démonstration
            </button>
          )}
        </div>
      </div>
    );
  }
}
