// nakama/src/laboral/pibe_factory.ts
//
// Procedural pibe generator for the daily recruit pool.
//
// Design decisions (from 03-CONTEXT.md):
//   D-10: Asymmetric trait reveal — PickValue has trait_2_hidden (the value stays
//         server-side); get_recruit_pool RPC replaces it with boolean `true`.
//   D-11: Infinite procedural spawn — deterministic per pick_id seed (djb2 + LCG).
//
// App-Store tone (CLAUDE.md §Tone): lunfardo only; no real barra leader names;
// no political references; trait sentiment is descriptive, not glorifying violence.
// All lists are whitelisted — no LLM, no scraped data (T-3-RS-10 mitigation).

// ─── Lunfardo name lists ───────────────────────────────────────────────────────

// 30 apodos: 15 from CONTEXT.md line 181 + 15 amplified. Zero real barra names.
export const APODOS: readonly string[] = [
  'El Tano', 'El Negro', 'El Pibe', 'Cabezón', 'Ruso', 'Toto',
  'Mauri', 'Lucho', 'Pichón', 'El Chino', 'Lalo', 'Wachín',
  'Cordobés', 'El Tincho', 'Coquito',
  'El Gordo', 'El Flaco', 'El Petiso', 'El Rubio', 'El Colorado',
  'Pocho', 'Coco', 'Beto', 'Nacho', 'Toti',
  'El Lobo', 'El Mono', 'El Loco', 'El Sapo', 'El Cabe',
];

// 20 common Argentine surnames.
export const NOMBRES: readonly string[] = [
  'Russo', 'Acosta', 'Pereira', 'Gomez', 'Martinez',
  'Lopez', 'Romero', 'Sosa', 'Diaz', 'Suarez',
  'Benitez', 'Vargas', 'Aguero', 'Cabrera', 'Torres',
  'Cruz', 'Molina', 'Rios', 'Castro', 'Ortega',
];

// ─── Trait pool ───────────────────────────────────────────────────────────────

export interface Trait {
  id: string;
  sign: 'positive' | 'negative' | 'neutral' | 'mixed';
  label: string;  // lunfardo label shown in UI
}

// 14 traits — UI-SPEC §8.4 vocab + sentiment. Matches CONTEXT.md trait pool.
// 'camorrero' / 'buchon' are game-folklore (not glorifying real behaviour).
// 'bostero' is rival-only lore; Phase 5 will gate by club rivalry. Phase 3 spawns normally.
export const TRAIT_POOL: readonly Trait[] = [
  { id: 'cabezon',    sign: 'negative', label: 'Cabezón' },
  { id: 'pies_plomo', sign: 'negative', label: 'Pies de plomo' },
  { id: 'camorrero',  sign: 'negative', label: 'Camorrero' },
  { id: 'buchon',     sign: 'negative', label: 'Buchón' },
  { id: 'pichon',     sign: 'neutral',  label: 'Pichón' },
  { id: 'cordobes',   sign: 'neutral',  label: 'Cordobés' },
  { id: 'porteno',    sign: 'neutral',  label: 'Porteño' },
  { id: 'pendejo',    sign: 'neutral',  label: 'Pendejo' },
  { id: 'aguantador', sign: 'positive', label: 'Aguantador' },
  { id: 'picaro',     sign: 'positive', label: 'Pícaro' },
  { id: 'veterano',   sign: 'positive', label: 'Veterano' },
  { id: 'tranquilo',  sign: 'positive', label: 'Tranquilo' },
  { id: 'loco',       sign: 'mixed',    label: 'Loco' },
  { id: 'bostero',    sign: 'neutral',  label: 'Bostero-detrás' },
];

// ─── Role weights ─────────────────────────────────────────────────────────────

// D-11: sum = 100 exactly.
// lider weight = 10 (rare, as per CONTEXT §D-11 — "líderes son raros").
export const ROL_WEIGHTS: readonly [string, number][] = [
  ['trompada',    25],
  ['aguantador',  20],
  ['corredor',    15],
  ['vigia',       10],
  ['pirotecnico', 10],
  ['lider',       10],
  ['abogado',      5],
  ['viejo',        5],
];

// ─── Avatar parts ─────────────────────────────────────────────────────────────

export const AVATAR_PARTS: {
  pelo: readonly string[];
  remera: readonly string[];
  accesorio: readonly string[];
} = {
  pelo:      ['rapado', 'corto', 'largo'],
  remera:    ['tricolor_1', 'tricolor_2', 'tricolor_3', 'negra'],
  accesorio: ['ninguno', 'gorra', 'capucha'],
};

// ─── Deterministic RNG (djb2 hash + linear-congruential) ─────────────────────

// djb2 hash: string → uint32 seed. Deterministic pick_id → same pibe every time.
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// LCG next state (not crypto; determinism is the goal).
function nextRng(state: number): number {
  return ((state * 1664525 + 1013904223) >>> 0);
}

function pickFromRng<T>(arr: readonly T[], state: number): { value: T; state: number } {
  const next = nextRng(state);
  return { value: arr[next % arr.length], state: next };
}

function pickWeighted(weights: readonly [string, number][], state: number): { value: string; state: number } {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const next = nextRng(state);
  let target = next % total;
  for (const [val, w] of weights) {
    if (target < w) return { value: val, state: next };
    target -= w;
  }
  return { value: weights[0][0], state: next };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

// PickValue is what get_recruit_pool returns (after trait_2_hidden VALUE is redacted).
// Server stores the pick_id → full pick mapping in recruit_pool/{club_id}.picks[].
export interface PickValue {
  pick_id: string;
  name: string;
  rol: string;
  trait_1: string;
  trait_2_hidden: string;  // STRING internally — RPC layer replaces with boolean true
  avatar: { pelo: string; remera: string; accesorio: string };
  stats_preview: { aguante: number; velocidad: number; astucia: number; carisma: number };
}

// ─── generatePick ─────────────────────────────────────────────────────────────

// Deterministic generator: same pick_id → same pibe (LAB-PIBE-DETERMINISTIC test).
// Uses nk.uuidv4() for a new pick_id on each call — caller stores the pick_id.
export function generatePick(nk: nkruntime.Nakama, _clubId: string): PickValue {
  const pickId = nk.uuidv4();
  let st = hashSeed(pickId);

  const apodo   = pickFromRng(APODOS, st);     st = apodo.state;
  const nombre  = pickFromRng(NOMBRES, st);    st = nombre.state;
  const rol     = pickWeighted(ROL_WEIGHTS, st); st = rol.state;
  const t1      = pickFromRng(TRAIT_POOL, st); st = t1.state;
  let   t2      = pickFromRng(TRAIT_POOL, st); st = t2.state;

  // Ensure trait_2 ≠ trait_1 (retry up to 20 times).
  let guard = 0;
  while (t2.value.id === t1.value.id && guard < 20) {
    t2 = pickFromRng(TRAIT_POOL, t2.state);
    st = t2.state;
    guard++;
  }

  const pelo      = pickFromRng(AVATAR_PARTS.pelo, st);      st = pelo.state;
  const remera    = pickFromRng(AVATAR_PARTS.remera, st);    st = remera.state;
  const accesorio = pickFromRng(AVATAR_PARTS.accesorio, st); st = accesorio.state;

  // Stats: 40..60 deterministic per pick (50 ± 10).
  const stat = (s: number): number => 40 + (nextRng(s) % 21);
  const aguante   = stat(st); st = nextRng(st);
  const velocidad = stat(st); st = nextRng(st);
  const astucia   = stat(st); st = nextRng(st);
  const carisma   = stat(st);

  return {
    pick_id: pickId,
    name:    apodo.value + ' ' + nombre.value,
    rol:     rol.value,
    trait_1: t1.value.id,
    trait_2_hidden: t2.value.id,  // actual value stored server-side; RPC redacts to boolean
    avatar: {
      pelo:      pelo.value,
      remera:    remera.value,
      accesorio: accesorio.value,
    },
    stats_preview: { aguante, velocidad, astucia, carisma },
  };
}

// ─── materializePibeFromPick ──────────────────────────────────────────────────

// Converts a PickValue into a full PibeRecord (reveals trait_2).
// Used by recruit_pibe (plan 03.03).
// Re-uses pick_id as pibe.id for traceability (LAB-RECRUIT-RACE invariant).
export function materializePibeFromPick(
  pick: PickValue,
  clubId: string,
  now: number,
): {
  id: string; name: string; club_id: string; rol: string;
  trait_1: string; trait_2: string;
  avatar: { pelo: string; remera: string; accesorio: string };
  stats: { aguante: number; velocidad: number; astucia: number; carisma: number };
  energia: number; energia_last_tick_at: number;
  profession: null; profession_started_at: null;
  last_collected_at: null;
  skills: { [k: string]: number };
  en_turno_until: null;
  created_at: number;
} {
  return {
    id:       pick.pick_id,
    name:     pick.name,
    club_id:  clubId,
    rol:      pick.rol,
    trait_1:  pick.trait_1,
    trait_2:  pick.trait_2_hidden,  // reveal on recruit
    avatar:   pick.avatar,
    stats:    pick.stats_preview,
    energia:  100,
    energia_last_tick_at: now,
    profession:         null,
    profession_started_at: null,
    last_collected_at:  null,
    skills: {
      trapito_hours:     0,
      vendedor_hours:    0,
      patovica_hours:    0,
      remisero_hours:    0,
      hablar_cana_hours: 0,
    },
    en_turno_until: null,
    created_at:     now,
  };
}
