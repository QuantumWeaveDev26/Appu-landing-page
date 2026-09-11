import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StudySessionItem {
  id: string;
  topic: string;
  scheduledAt: string; // ISO 8601 string
  timeDisplay: string; // e.g., "Today 5:00 PM"
  childId?: string;
  childName?: string;
  notes?: string;
  calendarUrl: string;
  createdAt: string;
}

const STUDY_SCHEDULE_STORAGE_KEY = 'appu_study_schedules';
export const DEFAULT_WHATSAPP_COMPANION = '919740595677';

/**
 * Generates a 0-OAuth Google Calendar render URL prefilled with study session details.
 */
export function buildGoogleCalendarUrl(
  topic: string,
  scheduledDate: Date,
  durationMinutes: number = 30,
  childName?: string
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatUtcDate = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  const startDate = new Date(scheduledDate);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const startUtc = formatUtcDate(startDate);
  const endUtc = formatUtcDate(endDate);

  const cleanTopic = topic.trim() || 'Study Session';
  const title = childName
    ? `Study ${cleanTopic} with APPU (${childName})`
    : `Study ${cleanTopic} with APPU`;

  const details = `APPU AI Tutor Learning Session on "${cleanTopic}".\nExplore concepts, ask questions, and practice interactive missions together!\nWebsite: https://appuai.online`;
  const location = 'APPU AI Tutor';

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startUtc}%2F${endUtc}&details=${encodeURIComponent(
    details
  )}&location=${encodeURIComponent(location)}`;
}

/**
 * Formats a study note or explanation for WhatsApp sharing (under 500 characters budget).
 */
export function formatWhatsAppStudyNote(text: string, childName?: string): string {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  const cleanChild = childName && childName.trim() ? childName.trim() : null;
  const header = cleanChild
    ? `*Study note from ${cleanChild} (via APPU):*\n`
    : `*Study note from APPU:*\n`;
  const footer = '\n\n_Shared via APPU Learning Companion_';

  const maxBudget = 490 - header.length - footer.length;
  if (sanitized.length > maxBudget) {
    sanitized = sanitized.slice(0, Math.max(0, maxBudget - 3)).trim() + '...';
  }

  const note = `${header}${sanitized}${footer}`;
  return note.length >= 500 ? note.slice(0, 496) + '...' : note;
}

/**
 * Constructs a wa.me sharing URL. If targetPhone is omitted or empty, links to WhatsApp general composer.
 */
export function buildWhatsAppShareUrl(
  targetPhone?: string,
  text?: string,
  childName?: string
): string {
  const formattedText = text ? formatWhatsAppStudyNote(text, childName) : '';
  const query = formattedText ? `?text=${encodeURIComponent(formattedText)}` : '';

  if (targetPhone && targetPhone.trim()) {
    const cleanPhone = targetPhone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}${query}`;
  }

  return `https://wa.me/${query}`;
}

/**
 * Builds the general WhatsApp invitation / share link for APPU.
 */
export function buildAppuAppShareUrl(language: string = 'en'): string {
  let msg =
    'Namaste! Check out APPU, the interactive AI tutor for children in English, Kannada, and Hindi. Learn math, science, and curiosity missions with real voice conversations: https://appuai.online';
  if (language === 'kn') {
    msg =
      'ನಮಸ್ಕಾರ! ಮಕ್ಕಳಿಗಾಗಿ ಸಂವಾದಾತ್ಮಕ AI ಶಿಕ್ಷಕ APPU ಅನ್ನು ನೋಡಿ (ಕನ್ನಡ, ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ). ವಿಜ್ಞಾನ, ಗಣಿತ ಮತ್ತು ಪ್ರಶ್ನೆಗಳನ್ನು ಧ್ವನಿಯಲ್ಲೇ ಕಲಿಯಿರಿ: https://appuai.online';
  } else if (language === 'hi') {
    msg =
      'नमस्ते! बच्चों के लिए इंटरैक्टिव AI ट्यूटर APPU देखें (हिंदी, इंग्लिश, कन्नड़)। विज्ञान, गणित और जिज्ञासा मिशन आवाज़ में सीखें: https://appuai.online';
  }
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/**
 * Retrieves all stored study sessions from AsyncStorage.
 */
export async function getStoredStudySessions(): Promise<StudySessionItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STUDY_SCHEDULE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists a new study session item to AsyncStorage.
 */
export async function saveStudySession(
  input: Omit<StudySessionItem, 'id' | 'createdAt' | 'calendarUrl'>
): Promise<StudySessionItem> {
  const current = await getStoredStudySessions();
  const scheduledDate = new Date(input.scheduledAt);
  const calendarUrl = buildGoogleCalendarUrl(
    input.topic,
    scheduledDate,
    30,
    input.childName
  );

  const newItem: StudySessionItem = {
    ...input,
    id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    calendarUrl,
    createdAt: new Date().toISOString(),
  };

  const updated = [newItem, ...current];
  await AsyncStorage.setItem(STUDY_SCHEDULE_STORAGE_KEY, JSON.stringify(updated));
  return newItem;
}

/**
 * Deletes a scheduled session by ID.
 */
export async function deleteStudySession(id: string): Promise<void> {
  const current = await getStoredStudySessions();
  const updated = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STUDY_SCHEDULE_STORAGE_KEY, JSON.stringify(updated));
}
