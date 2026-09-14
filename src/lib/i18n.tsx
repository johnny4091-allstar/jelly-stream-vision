import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "es" | "fr";

const STORAGE_KEY = "aurora-language";

const messages = {
  en: {
    play: "Play", moreInfo: "More Info", continueWatching: "Continue Watching",
    nextUp: "Next Up", browseAll: "Browse all", audio: "Audio", retryPlayback: "Retry playback",
    loadingStream: "Loading your stream…", converted: "Converted", direct: "Direct",
    signInSubtitle: "Sign in to your Aurora account", username: "Username", password: "Password",
    signIn: "Sign In", signingIn: "Signing in…", newHere: "New here?", createAccount: "Create an account",
    createSubtitle: "Create your account — a matching media profile is made for you",
    confirmPassword: "Confirm password", creating: "Creating…", alreadyAccount: "Already have an account?",
    allGenres: "All genres", allYears: "All years", allRatings: "All ratings", clear: "Clear",
    watchlist: "My watchlist", history: "Watch history", search: "Search", people: "Manage people",
    signOut: "Sign out", language: "Language", back: "Back", episodes: "Episodes", starring: "Starring",
    resume: "Resume", subtitles: "Subtitles", off: "Off", featured: "Featured titles",
    previous: "Previous title", next: "Next title", showSlide: "Show featured title",
    liveTv: "Live TV", channels: "Channels", guide: "Guide", recordings: "Recordings",
    searchChannels: "Search channels", allChannels: "All channels", favorites: "Favorites",
    noChannels: "No channels match this filter.", noProgramInfo: "No program info",
    nowAndNext: "Now and next, 4 hours ahead", watchNow: "Watch now", record: "Record",
    recordSeries: "Record series", close: "Close", recorded: "Recorded",
    noRecordings: "Nothing recorded yet.", scheduled: "Scheduled", noScheduled: "Nothing scheduled.",
    seriesLabel: "Series", cancelRecording: "Cancel recording", liveBadge: "Live",
    streamFailed: "The channel could not be started. Tap retry.",
    streamInterrupted: "The channel was interrupted. Tap retry.",
  },
  es: {
    play: "Reproducir", moreInfo: "Más información", continueWatching: "Seguir viendo",
    nextUp: "A continuación", browseAll: "Ver todo", audio: "Audio", retryPlayback: "Reintentar",
    loadingStream: "Cargando…", converted: "Convertido", direct: "Directo",
    signInSubtitle: "Inicia sesión en tu cuenta de Aurora", username: "Usuario", password: "Contraseña",
    signIn: "Iniciar sesión", signingIn: "Iniciando…", newHere: "¿Eres nuevo?", createAccount: "Crear una cuenta",
    createSubtitle: "Crea tu cuenta y tu perfil multimedia al mismo tiempo",
    confirmPassword: "Confirmar contraseña", creating: "Creando…", alreadyAccount: "¿Ya tienes una cuenta?",
    allGenres: "Todos los géneros", allYears: "Todos los años", allRatings: "Todas las clasificaciones", clear: "Borrar",
    watchlist: "Mi lista", history: "Historial", search: "Buscar", people: "Administrar personas",
    signOut: "Cerrar sesión", language: "Idioma", back: "Volver", episodes: "Episodios", starring: "Reparto",
    resume: "Continuar", subtitles: "Subtítulos", off: "Desactivados", featured: "Títulos destacados",
    previous: "Título anterior", next: "Título siguiente", showSlide: "Mostrar título destacado",
    liveTv: "TV en vivo", channels: "Canales", guide: "Guía", recordings: "Grabaciones",
    searchChannels: "Buscar canales", allChannels: "Todos los canales", favorites: "Favoritos",
    noChannels: "Ningún canal coincide con este filtro.", noProgramInfo: "Sin información",
    nowAndNext: "Ahora y las próximas 4 horas", watchNow: "Ver ahora", record: "Grabar",
    recordSeries: "Grabar serie", close: "Cerrar", recorded: "Grabado",
    noRecordings: "Todavía no hay grabaciones.", scheduled: "Programado", noScheduled: "Nada programado.",
    seriesLabel: "Serie", cancelRecording: "Cancelar grabación", liveBadge: "En vivo",
    streamFailed: "No se pudo iniciar el canal. Toca reintentar.",
    streamInterrupted: "El canal se interrumpió. Toca reintentar.",
  },
  fr: {
    play: "Lire", moreInfo: "Plus d’infos", continueWatching: "Continuer à regarder",
    nextUp: "À suivre", browseAll: "Tout parcourir", audio: "Audio", retryPlayback: "Réessayer",
    loadingStream: "Chargement…", converted: "Converti", direct: "Direct",
    signInSubtitle: "Connectez-vous à votre compte Aurora", username: "Nom d’utilisateur", password: "Mot de passe",
    signIn: "Se connecter", signingIn: "Connexion…", newHere: "Nouveau ici ?", createAccount: "Créer un compte",
    createSubtitle: "Créez votre compte et votre profil multimédia en même temps",
    confirmPassword: "Confirmer le mot de passe", creating: "Création…", alreadyAccount: "Vous avez déjà un compte ?",
    allGenres: "Tous les genres", allYears: "Toutes les années", allRatings: "Toutes les classifications", clear: "Effacer",
    watchlist: "Ma liste", history: "Historique", search: "Rechercher", people: "Gérer les utilisateurs",
    signOut: "Se déconnecter", language: "Langue", back: "Retour", episodes: "Épisodes", starring: "Avec",
    resume: "Reprendre", subtitles: "Sous-titres", off: "Désactivés", featured: "Titres à la une",
    previous: "Titre précédent", next: "Titre suivant", showSlide: "Afficher le titre à la une",
    liveTv: "TV en direct", channels: "Chaînes", guide: "Guide", recordings: "Enregistrements",
    searchChannels: "Rechercher des chaînes", allChannels: "Toutes les chaînes", favorites: "Favoris",
    noChannels: "Aucune chaîne ne correspond.", noProgramInfo: "Aucune information",
    nowAndNext: "Maintenant et les 4 prochaines heures", watchNow: "Regarder", record: "Enregistrer",
    recordSeries: "Enregistrer la série", close: "Fermer", recorded: "Enregistré",
    noRecordings: "Aucun enregistrement.", scheduled: "Programmé", noScheduled: "Rien de programmé.",
    seriesLabel: "Série", cancelRecording: "Annuler l’enregistrement", liveBadge: "Direct",
    streamFailed: "La chaîne n’a pas pu démarrer. Réessayez.",
    streamInterrupted: "La chaîne a été interrompue. Réessayez.",
  },
} as const;

type MessageKey = keyof typeof messages.en;
type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: MessageKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "es" || saved === "fr") setLanguageState(saved);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (next) => {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
      setLanguageState(next);
    },
    t: (key) => messages[language][key],
  }), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      {!compact && <span>{t("language")}</span>}
      <select
        aria-label={t("language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as AppLanguage)}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
      >
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
      </select>
    </label>
  );
}

export const audioLanguageCodes: Record<AppLanguage, string[]> = {
  en: ["en", "eng"],
  es: ["es", "spa", "esp"],
  fr: ["fr", "fra", "fre"],
};