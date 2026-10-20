/**
 * Rôle du fichier : Bouton réutilisable permettant d'afficher ou de masquer un mot de passe.
 */

'use client'

type Props = {
  visible: boolean
  onToggle: () => void
  className?: string
}

/** Composant principal de cette page ou zone d'interface. */
export default function PasswordVisibilityButton({ visible, onToggle, className }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c5.5 0 9 5 9 5a16 16 0 0 1-2.1 2.7" />
          <path d="M6.6 6.6C4.3 8 3 10 3 10s3.5 5 9 5c1 0 2-.17 2.9-.48" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )}
    </button>
  )
}
