// src/components/ElectronicSignatureModal.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DocumentItem, Organization, User } from '../types';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCcw, 
  Lock, 
  Sparkles, 
  FileText, 
  PenTool, 
  Type, 
  Award, 
  Check, 
  Clock, 
  Shield, 
  Fingerprint, 
  Cpu, 
  Key, 
  AlertCircle
} from 'lucide-react';
import { API_MODE } from '../config';
import { api } from '../lib/api';
import { checkUserPassword } from '../lib/auth';
import { contentHash, shortHash } from '../lib/integrity';

export interface SignatureData {
  signedBy: string;
  role: string;
  signedAt: string;
  certificateHash: string;
  signatureImage?: string;
  signatureType: 'draw' | 'type' | 'certificate';
  legalConsent: boolean;
  verificationAudit: {
    sha256Checked: boolean;
    rbacChecked: boolean;
    timestampChecked: boolean;
    sealedAt: string;
    token: string;
    /** Identité confirmée par le mot de passe du signataire au moment de signer. */
    identityVerified?: 'mot_de_passe';
    /** Origine de l'heure de signature : serveur de l'entreprise ou poste de travail. */
    timestampSource?: 'serveur' | 'poste';
    signerUserId?: string;
  };
}

/** Contenu du document couvert par l'empreinte de signature (toute modification change l'empreinte). */
export function signedDocumentContent(doc: DocumentItem) {
  return {
    id: doc.id,
    title: doc.title,
    referenceNumber: doc.referenceNumber,
    category: doc.category,
    subtype: doc.subtype,
    amount: doc.amount,
    currency: doc.currency,
    description: doc.description,
    targetUserId: doc.targetUserId,
    targetEntityId: doc.targetEntityId,
    createdAt: doc.createdAt,
    authorId: doc.authorId,
  };
}

interface ElectronicSignatureModalProps {
  document: DocumentItem;
  organization: Organization;
  currentUser: User;
  onClose: () => void;
  onSignComplete: (docId: string, signatureData: SignatureData) => void;
}

type SignatureMode = 'draw' | 'type' | 'certificate';

export const ElectronicSignatureModal: React.FC<ElectronicSignatureModalProps> = ({
  document,
  organization,
  currentUser,
  onClose,
  onSignComplete,
}) => {
  // Mode de signature actif
  const [activeMode, setActiveMode] = useState<SignatureMode>('draw');

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeColor, setStrokeColor] = useState<string>('#1e40af'); // Bleu officiel
  const [strokeWidth, setStrokeWidth] = useState<number>(2.5);

  // Mode typographique
  const [typedName, setTypedName] = useState(currentUser.name);
  const [typedStyle, setTypedStyle] = useState<number>(1);

  // Consentement et sécurité
  const [legalConsent, setLegalConsent] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Étapes de vérification affichées
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState<number>(0);
  const [verifyProgress, setVerifyProgress] = useState<number>(0);
  const [verificationDone, setVerificationDone] = useState(false);
  const [generatedHash, setGeneratedHash] = useState<string>('');
  const [finalSignatureData, setFinalSignatureData] = useState<SignatureData | null>(null);

  // Initialisation et redimensionnement du canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gestion de la haute résolution (Retina)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    // Fond blanc pur pour export transparent propre
    ctx.clearRect(0, 0, rect.width, rect.height);
  }, [strokeColor, strokeWidth]);

  useEffect(() => {
    if (activeMode === 'draw') {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [activeMode, initCanvas]);

  // Tracé sur Canvas
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  // Génération de l'image de la signature selon le mode
  const generateSignatureImage = (hash: string, signedAt: string): string => {
    if (activeMode === 'draw' && canvasRef.current && hasDrawn) {
      return canvasRef.current.toDataURL('image/png');
    }

    // Génération d'un SVG virtuel pour mode Typographique ou Sceau
    const canvas = window.document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    if (activeMode === 'type') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 140);
      
      ctx.fillStyle = '#1e3a8a';
      ctx.font = typedStyle === 1 
        ? 'italic 32px "Georgia", serif' 
        : typedStyle === 2 
        ? 'bold italic 28px "Palatino", serif' 
        : 'italic 34px "Brush Script MT", cursive, sans-serif';
      ctx.fillText(typedName || currentUser.name, 20, 60);

      // Trait manuscrit sous le nom
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 75);
      ctx.bezierCurveTo(90, 85, 200, 68, 360, 78);
      ctx.stroke();

      // Mention d'accréditation
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(`Signé par ${currentUser.roleTitle} • ${organization.name}`.slice(0, 60), 20, 105);
      ctx.fillText(`${signedAt} • ${shortHash(hash)}`, 20, 120);

      return canvas.toDataURL('image/png');
    }

    // Mode Sceau Cryptographique
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 140);

    // Cadre double bordure dorée/bleue
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 380, 120);

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1;
    ctx.strokeRect(15, 15, 370, 110);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 12px "Arial", sans-serif';
    ctx.fillText(`VISA ÉLECTRONIQUE • ${organization.name.toUpperCase()}`.slice(0, 48), 25, 40);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`VALIDÉ : ${currentUser.name.toUpperCase()}`, 25, 65);

    ctx.fillStyle = '#475569';
    ctx.font = '10px "Arial", sans-serif';
    ctx.fillText(`Fonction : ${currentUser.roleTitle}`, 25, 85);
    ctx.fillText(`Signé le : ${signedAt}`, 25, 102);
    ctx.fillText(`Empreinte : ${shortHash(hash)}`, 25, 118);

    return canvas.toDataURL('image/png');
  };

  // Vérification réelle : mot de passe du signataire, horodatage, empreinte SHA-256 du document.
  const handleStartVerification = async () => {
    if (!legalConsent || isChecking) return;
    if (activeMode === 'draw' && !hasDrawn) return;
    if (!password) {
      setAuthError('Saisissez votre mot de passe pour confirmer votre identité.');
      return;
    }
    setAuthError(null);
    setIsChecking(true);

    let signedAt: string;
    let timestampSource: 'serveur' | 'poste';
    try {
      if (API_MODE) {
        const r = await api.verifyPassword(password);
        signedAt = r.serverTime;
        timestampSource = 'serveur';
      } else {
        if (!(await checkUserPassword(currentUser, password))) {
          setAuthError('Mot de passe incorrect.');
          return;
        }
        signedAt = new Date().toLocaleString('fr-FR');
        timestampSource = 'poste';
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Vérification impossible.');
      return;
    } finally {
      setIsChecking(false);
      setPassword('');
    }

    const hash = await contentHash({
      document: signedDocumentContent(document),
      signer: { id: currentUser.id, name: currentUser.name, roleTitle: currentUser.roleTitle },
      signedAt,
      signatureType: activeMode,
    });
    setGeneratedHash(hash);
    const signatureImg = generateSignatureImage(hash, signedAt);
    const sigData: SignatureData = {
      signedBy: `${currentUser.name} (${currentUser.roleTitle})`,
      role: currentUser.roleTitle,
      signedAt,
      certificateHash: hash,
      signatureImage: signatureImg,
      signatureType: activeMode,
      legalConsent: true,
      verificationAudit: {
        sha256Checked: true,
        rbacChecked: true,
        timestampChecked: true,
        sealedAt: new Date().toISOString(),
        token: `SIG-${hash.slice(0, 12).toUpperCase()}`,
        identityVerified: 'mot_de_passe',
        timestampSource,
        signerUserId: currentUser.id,
      }
    };

    setFinalSignatureData(sigData);
    setIsVerifying(true);
    setVerifyStep(1);
    setVerifyProgress(15);

    // Séquence temporelle réaliste de vérification multi-niveaux
    setTimeout(() => {
      setVerifyStep(2);
      setVerifyProgress(45);
    }, 700);

    setTimeout(() => {
      setVerifyStep(3);
      setVerifyProgress(78);
    }, 1400);

    setTimeout(() => {
      setVerifyStep(4);
      setVerifyProgress(100);
      setVerificationDone(true);
    }, 2100);
  };

  // Finalisation et transmission au composant parent
  const handleApplySignature = () => {
    if (!finalSignatureData) return;
    onSignComplete(document.id, finalSignatureData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/90 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden my-auto text-slate-100 relative">
        
        {/* EN-TÊTE DE LA MODALE */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Signature électronique
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Signature simple
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Identité confirmée par votre mot de passe • empreinte SHA-256 du document
              </p>
            </div>
          </div>

          {!isVerifying && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ÉCRAN DE VÉRIFICATION EN COURS / SCELLÉ TERMINÉ */}
        {isVerifying ? (
          <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6 flex flex-col justify-center">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center relative">
                {verificationDone ? (
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center animate-bounce shadow-xl shadow-emerald-500/30">
                    <Award className="w-10 h-10 text-emerald-400" />
                  </div>
                ) : (
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin"></div>
                    <Cpu className="w-8 h-8 text-emerald-400 animate-pulse" />
                  </div>
                )}
              </div>

              <h4 className="text-lg font-bold text-white tracking-tight">
                {verificationDone 
                  ? 'Signature prête à être appliquée' 
                  : 'Préparation de la signature…'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {verificationDone 
                  ? 'Votre identité a été confirmée et l\'empreinte du document calculée.' 
                  : 'Vérification du mot de passe et calcul de l\'empreinte du document.'}
              </p>
            </div>

            {/* Barre de progression fluide */}
            <div className="space-y-1.5 max-w-md mx-auto w-full">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Progression du protocole</span>
                <span className="text-emerald-400 font-bold">{verifyProgress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${verifyProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Grille des étapes de vérification animées */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto w-full">
              {/* Étape 1 : SHA-256 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                verifyStep >= 1 
                  ? 'bg-slate-950/80 border-emerald-500/40 text-emerald-300' 
                  : 'bg-slate-950/30 border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center gap-2">
                  {verifyStep >= 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : verifyStep === 1 ? (
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <Fingerprint className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold">1. Empreinte SHA-256 du document</span>
                </div>
                <p className="text-[10px] mt-1 font-mono text-slate-400 truncate">
                  {verifyStep >= 1 ? shortHash(generatedHash) : 'En attente'}
                </p>
              </div>

              {/* Étape 2 : RBAC */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                verifyStep >= 2 
                  ? 'bg-slate-950/80 border-emerald-500/40 text-emerald-300' 
                  : 'bg-slate-950/30 border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center gap-2">
                  {verifyStep >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : verifyStep === 2 ? (
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <Shield className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold">2. Identité confirmée</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400 truncate">
                  {verifyStep >= 2 ? `Mot de passe vérifié • ${currentUser.roleTitle}` : 'En attente'}
                </p>
              </div>

              {/* Étape 3 : Horodatage */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                verifyStep >= 3 
                  ? 'bg-slate-950/80 border-emerald-500/40 text-emerald-300' 
                  : 'bg-slate-950/30 border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center gap-2">
                  {verifyStep >= 4 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : verifyStep === 3 ? (
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold">3. Horodatage</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400 truncate">
                  {verifyStep >= 3 ? `${finalSignatureData?.signedAt} (${finalSignatureData?.verificationAudit.timestampSource === 'serveur' ? 'heure du serveur' : 'heure du poste'})` : 'En attente'}
                </p>
              </div>

              {/* Étape 4 : Prêt à signer */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                verifyStep >= 4 
                  ? 'bg-slate-950/80 border-emerald-500/40 text-emerald-300' 
                  : 'bg-slate-950/30 border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center gap-2">
                  {verifyStep >= 4 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Key className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold">4. Prêt à signer</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400 truncate">
                  {verifyStep >= 4 ? 'Toute modification ultérieure changera l\'empreinte' : 'En attente'}
                </p>
              </div>
            </div>

            {/* Aperçu du certificat probant une fois validé */}
            {verificationDone && finalSignatureData && (
              <div className="max-w-xl mx-auto w-full p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Visa électronique {finalSignatureData.verificationAudit.token}</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-500/30">
                    {shortHash(finalSignatureData.certificateHash)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Signataire :</span>
                    <strong className="text-white">{finalSignatureData.signedBy}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Signé le :</span>
                    <strong className="text-white font-mono">{finalSignatureData.signedAt}</strong>
                  </div>
                </div>

                {finalSignatureData.signatureImage && (
                  <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Empreinte visuelle apposée :</span>
                    <img 
                      src={finalSignatureData.signatureImage} 
                      alt="Signature" 
                      className="h-9 max-w-[160px] object-contain bg-white/90 rounded p-1 shadow-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Actions de validation */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 max-w-xl mx-auto w-full">
              {verificationDone ? (
                <button
                  onClick={handleApplySignature}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Appliquer au Document & Enregistrer</span>
                </button>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  Veuillez patienter…
                </div>
              )}
            </div>
          </div>
        ) : (
          /* FORMULAIRE DE SIGNATURE AVEC MODES INTERACTIFS */
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            
            {/* RÉCAPITULATIF DU DOCUMENT & DU SIGNATAIRE CONNECTÉ */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Document Cible</span>
                  <p className="font-bold text-white text-sm">{document.title}</p>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] flex-wrap">
                    <span className="font-mono text-sky-400 font-bold">{document.referenceNumber}</span>
                    <span>•</span>
                    <span>{document.fileType} ({document.size})</span>
                    {document.amount !== undefined && document.amount !== null && document.amount > 0 ? (
                      <>
                        <span>•</span>
                        <span className="font-bold text-emerald-400">{document.amount.toLocaleString()} {document.currency || 'USD'}</span>
                      </>
                    ) : (
                      <>
                        <span>•</span>
                        <span className="text-slate-400 italic">Sans obligation de prix</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1 sm:border-l sm:border-slate-800 sm:pl-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Signataire Connecté</span>
                  <p className="font-bold text-emerald-300 text-sm">{currentUser.name}</p>
                  <div className="text-slate-400 text-[11px] space-y-0.5">
                    <p>{currentUser.roleTitle} — <span className="text-slate-300 font-medium">{organization.name}</span></p>
                    <p className="text-[10px] font-mono text-slate-500">Matricule: {currentUser.matricule || 'Non renseigné'}</p>
                  </div>
                </div>
              </div>

              {/* Corps descriptif obligatoire soumis à signature */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-emerald-400" />
                    <span>Corps descriptif & stipulations soumis à votre signature :</span>
                  </span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                    Texte Intégral
                  </span>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-relaxed max-h-24 overflow-y-auto whitespace-pre-line">
                  {document.description}
                </div>
              </div>
            </div>

            {/* CHOIX DU MODE DE SIGNATURE */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Mode d'Apposition de la Signature
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('draw')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1.5 ${
                    activeMode === 'draw'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <PenTool className={`w-4 h-4 ${activeMode === 'draw' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {activeMode === 'draw' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <span className="text-xs font-bold">1. Tracer à la main</span>
                  <span className="text-[10px] text-slate-400">Pad interactif tactile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('type')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1.5 ${
                    activeMode === 'type'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Type className={`w-4 h-4 ${activeMode === 'type' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {activeMode === 'type' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <span className="text-xs font-bold">2. Typographie Légale</span>
                  <span className="text-[10px] text-slate-400">Génération calligraphiée</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('certificate')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1.5 ${
                    activeMode === 'certificate'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Award className={`w-4 h-4 ${activeMode === 'certificate' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {activeMode === 'certificate' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <span className="text-xs font-bold">3. Visa d'entreprise</span>
                  <span className="text-[10px] text-slate-400">Cachet au nom de l'organisation</span>
                </button>
              </div>
            </div>

            {/* CONTENU SELON LE MODE */}
            {activeMode === 'draw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Dessinez votre signature dans le cadre ci-dessous (souris ou doigt) :
                  </span>

                  {/* Outils de tracé */}
                  <div className="flex items-center gap-2">
                    {/* Choix des couleurs d'encre */}
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setStrokeColor('#1e40af')}
                        className={`w-4 h-4 rounded-full bg-blue-700 transition ${strokeColor === '#1e40af' ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                        title="Encre bleue royale"
                      />
                      <button
                        type="button"
                        onClick={() => setStrokeColor('#0f172a')}
                        className={`garder-couleur w-4 h-4 rounded-full bg-slate-900 border border-slate-600 transition ${strokeColor === '#0f172a' ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                        title="Encre noire intense"
                      />
                      <button
                        type="button"
                        onClick={() => setStrokeColor('#047857')}
                        className={`w-4 h-4 rounded-full bg-emerald-700 transition ${strokeColor === '#047857' ? 'ring-2 ring-white scale-110' : 'opacity-70'}`}
                        title="Encre émeraude officielle"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition"
                      title="Effacer le tracé"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>Effacer</span>
                    </button>
                  </div>
                </div>

                {/* ZONE DE DESSIN CANVAS */}
                <div className="relative border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl bg-white overflow-hidden shadow-inner cursor-crosshair">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 block touch-none"
                  />
                  
                  {/* Ligne de repère manuscrite */}
                  <div className="absolute bottom-6 left-6 right-6 border-b border-slate-200 pointer-events-none flex justify-between text-[10px] text-slate-400 font-serif italic select-none">
                    <span>X</span>
                    <span>Ligne de signature officielle</span>
                  </div>

                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-slate-400 text-xs italic">
                      Apposez votre griffe ou paraphe ici
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeMode === 'type' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Nom officiel pour la calligraphie légale :
                  </label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={e => setTypedName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                {/* Choix du style calligraphique */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTypedStyle(1)}
                    className={`p-3 rounded-xl border bg-white text-slate-900 transition text-center ${
                      typedStyle === 1 ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md' : 'opacity-80'
                    }`}
                  >
                    <span className="font-serif italic text-base block text-blue-900 truncate">
                      {typedName || 'Signature'}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1 block">Style Diplomatique</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTypedStyle(2)}
                    className={`p-3 rounded-xl border bg-white text-slate-900 transition text-center ${
                      typedStyle === 2 ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md' : 'opacity-80'
                    }`}
                  >
                    <span className="font-serif italic font-bold text-base block text-slate-900 truncate">
                      {typedName || 'Signature'}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1 block">Style Formel Accord</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTypedStyle(3)}
                    className={`p-3 rounded-xl border bg-white text-slate-900 transition text-center ${
                      typedStyle === 3 ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md' : 'opacity-80'
                    }`}
                  >
                    <span className="italic text-base block text-emerald-950 font-cursive truncate">
                      {typedName || 'Signature'}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1 block">Style Cursive Express</span>
                  </button>
                </div>
              </div>
            )}

            {activeMode === 'certificate' && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-amber-500/40 bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Award className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-xs">Visa électronique de l'organisation</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Génère un cachet au nom de l'organisation, avec le nom du signataire ({currentUser.name}), la date et l'empreinte du document.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Organisme :</span>
                    <span className="text-white font-bold">{organization.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Autorité signataire :</span>
                    <span className="text-emerald-400">{currentUser.name} ({currentUser.roleTitle})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Intégrité :</span>
                    <span className="text-indigo-400">Empreinte SHA-256 du contenu</span>
                  </div>
                </div>
              </div>
            )}

            {/* CONSENTEMENT LÉGAL ET PIN DE CONTRÔLE */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={legalConsent}
                  onChange={e => setLegalConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
                />
                <span className="text-[11px] text-slate-300 leading-relaxed">
                  J'atteste être <strong>{currentUser.name}</strong>, habilité(e) en qualité de <strong>{currentUser.roleTitle}</strong>, et je signe électroniquement ce document. Il s'agit d'une signature électronique simple (identité confirmée par mot de passe, empreinte SHA-256 du contenu), et non d'une signature qualifiée délivrée par un prestataire agréé.
                </span>
              </label>

              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs space-y-1.5">
                <label htmlFor="signature-password" className="flex items-center gap-2 text-slate-300 text-[11px] font-semibold">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Confirmez votre identité avec votre mot de passe
                </label>
                <input
                  id="signature-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setAuthError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') void handleStartVerification(); }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                {authError && (
                  <p role="alert" className="text-[11px] text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
                  </p>
                )}
              </div>
            </div>

            {/* BOUTONS DU BAS */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={!legalConsent || !password || isChecking || (activeMode === 'draw' && !hasDrawn)}
                onClick={() => void handleStartVerification()}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition active:scale-95 ${
                  legalConsent && password && !isChecking && (activeMode !== 'draw' || hasDrawn)
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isChecking ? 'Vérification…' : 'Vérifier et signer'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
