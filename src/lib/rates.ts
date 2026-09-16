export interface RateRule {
  id: string;
  label: string;
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  discount: number;
}

/** Senior / Jubilado rules. Extendable for future rate programs. */
export const SENIOR_RULES: RateRule[] = [
  { id: "weekday", label: "Lun-Jue (-50%)", days: [1, 2, 3, 4], discount: 0.5 },
  { id: "weekend", label: "Vie-Dom (-30%)", days: [5, 6, 0], discount: 0.3 },
];

export const DAY_NAMES_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export interface NightRate {
  date: string;
  day: string;
  ruleLabel: string;
  rate: number;
}

export interface RateResult {
  nights: NightRate[];
  nightCount: number;
  avgPerNight: number;
  totalStay: number;
  paxExtraTotal: number;
  totalWithTax: number;
}

const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
};

export const toISO = (d: Date) => d.toISOString().slice(0, 10);

export function calculateSeniorRate(opts: {
  arrival: string;
  departure: string;
  regularRate: number;
  paxExtra: number;
  paxExtraRate: number;
  taxRate: number;
  rules?: RateRule[];
}): RateResult {
  const rules = opts.rules ?? SENIOR_RULES;
  const nights: NightRate[] = [];
  const start = parseISO(opts.arrival);
  const end = parseISO(opts.departure);

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    const rule = rules.find((r) => r.days.includes(dow));
    const discount = rule?.discount ?? 0;
    nights.push({
      date: toISO(d),
      day: DAY_NAMES_ES[dow]!,
      ruleLabel: rule?.label ?? "Sin descuento",
      rate: +(opts.regularRate * (1 - discount)).toFixed(2),
    });
  }

  const totalStay = +nights.reduce((s, n) => s + n.rate, 0).toFixed(2);
  const paxExtraTotal = +(opts.paxExtra * opts.paxExtraRate * nights.length).toFixed(2);
  const base = totalStay + paxExtraTotal;

  return {
    nights,
    nightCount: nights.length,
    avgPerNight: nights.length ? +(totalStay / nights.length).toFixed(2) : 0,
    totalStay,
    paxExtraTotal,
    totalWithTax: +(base * (1 + opts.taxRate)).toFixed(2),
  };
}

export const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
