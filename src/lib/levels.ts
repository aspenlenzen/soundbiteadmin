// The 7-level sound scale, mirrored from the SoundBite app's SoundLevelSlider
// (words, descriptions, and colors must stay in step with the app).
export type LevelDef = { rating: number; word: string; desc: string; color: string };

export const LEVELS: LevelDef[] = [
  { rating: 1, word: 'Nearly silent', desc: 'Library rules. You could hear a pin drop or take a nap.', color: '#2E7D46' },
  { rating: 2, word: 'Quiet', desc: 'Comfortable and calm. You can talk normally without ever raising your voice.', color: '#34C759' },
  { rating: 3, word: 'Chatty', desc: "The room's got some life to it. Conversation flows easily, table to table.", color: '#7CB342' },
  { rating: 4, word: 'Moderate', desc: "A steady hum of conversation. You'll speak at your normal volume without much effort.", color: '#B98A00' },
  { rating: 5, word: 'Boisterous', desc: "High energy and loud. You're raising your voice and leaning in but not shouting.", color: '#C07A2E' },
  { rating: 6, word: 'Loud', desc: 'Yelling is the norm. Get ready to repeat yourself and read lips.', color: '#C96A00' },
  { rating: 7, word: 'Ear-splitting', desc: "It's party time. Save the conversation for the walk home.", color: '#C40000' },
];

export const levelFor = (rating: number | null | undefined): LevelDef | null =>
  LEVELS.find((l) => l.rating === rating) ?? null;

// Rooms the app offers when posting a bite (mirrors src/data/biteOptions.ts).
export const APP_ROOMS = [
  'Front Room',
  'Back Room',
  'Bar',
  'Upstairs',
  'Front Patio',
  'Back Patio',
  'Terrace',
  'Rooftop',
  'Private Room',
];

// Older enum values that still exist in the database's room_type enum. Rows may
// carry them, so editing must keep them selectable.
export const LEGACY_ROOMS = ['Main dining room', 'Patio', 'Private room', 'Other'];

// Tag chips the app offers (mirrors src/data/biteOptions.ts); the column is
// free text[] so anything else is allowed too.
export const TAGS = [
  'Kid Friendly',
  'Dog Friendly',
  'Sports on TV',
  'Gluten Friendly',
  'Live Music',
  'Date Night',
  'Outdoor Seating',
  'Good for Groups',
  'Good for Working',
  'Has boardgames',
  'Takeaway Only',
  'Standing Room Only',
];

const TAG_EMOJI: Record<string, string> = {
  'Kid Friendly': '🧒',
  'Dog Friendly': '🐕',
  'Gluten Friendly': '🌾',
  'Live Music': '🎸',
  'Outdoor Seating': '⛱️',
  'Date Night': '🕯️',
  'Good for Groups': '👥',
  'Good for Working': '💻',
  'Sports on TV': '⚽',
  'Takeaway Only': '🥡',
  'Standing Room Only': '🧍',
  'Has boardgames': '🎲',
};

export const tagLabel = (tag: string) => (TAG_EMOJI[tag] ? `${TAG_EMOJI[tag]} ${tag}` : tag);
