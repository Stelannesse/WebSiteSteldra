export function getAuthErrorMessage(error: unknown, fallback = "Une erreur est survenue. Veuillez réessayer.") {
  if (!error || typeof error !== 'object') return fallback

  const authError = error as { message?: string; code?: string; status?: number }
  const message = (authError.message || '').toLowerCase()
  const code = (authError.code || '').toLowerCase()

  if (
    code.includes('over_email_send_rate_limit') ||
    code.includes('over_request_rate_limit') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('email rate limit exceeded')
  ) {
    return "Trop de demandes ont été envoyées. Attendez quelques minutes avant de demander un nouveau lien de réinitialisation. Le dernier lien reçu peut encore fonctionner s'il n'a pas expiré."
  }

  if (code.includes('email_address_invalid') || message.includes('invalid email')) {
    return "Cette adresse e-mail n'est pas valide."
  }

  if (code.includes('signup_disabled') || message.includes('signups not allowed')) {
    return "La création de compte est actuellement désactivée."
  }

  if (
    code.includes('user_already_exists') ||
    message.includes('user already registered') ||
    message.includes('already been registered')
  ) {
    return "Un compte existe déjà avec cette adresse e-mail."
  }

  if (code.includes('weak_password') || message.includes('password should be')) {
    return "Ce mot de passe n'est pas assez sécurisé. Utilisez au moins 8 caractères."
  }

  if (code.includes('same_password') || message.includes('same password')) {
    return "Le nouveau mot de passe doit être différent de l'ancien."
  }

  if (
    code.includes('otp_expired') ||
    code.includes('flow_state_not_found') ||
    message.includes('expired') ||
    message.includes('invalid otp')
  ) {
    return "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez un nouveau lien."
  }

  if (code.includes('session_not_found') || message.includes('auth session missing')) {
    return "La session de réinitialisation n'est plus valide. Demandez un nouveau lien par e-mail."
  }

  if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) {
    return "Votre adresse e-mail n'a pas encore été confirmée. Consultez votre boîte mail."
  }

  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) {
    return "E-mail ou mot de passe incorrect."
  }

  return fallback
}
