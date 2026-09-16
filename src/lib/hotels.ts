import type { Accommodation, HotelTemplate } from "@/workspace/types";

const ACCOMMODATIONS: Accommodation[] = ["Single", "Double", "Triple", "Quadruple"];

export const HOTELS: HotelTemplate[] = [
  {
    id: "ac-hotel",
    name: "AC Hotel",
    address: "Punta Pacífica, Ciudad de Panamá, Panamá",
    accent: "#707070",
    secondary: "#9a9a9a",
    tint: "#F4F4F4",
    roomTypes: ["King Bed", "Two Queen Beds", "Ocean View King", "AC Corner Suite"],
    accommodations: ACCOMMODATIONS,
    checkIn: "15:00",
    checkOut: "12:00",
    taxRate: 0.1,
    taxLabel: "ITBMS (10%)",
    es: {
      intro:
        "Estimado cliente, agradecemos su interés en AC Hotel. A continuación presentamos la cotización de hospedaje de acuerdo con las fechas y condiciones solicitadas.",
      descriptionTemplate:
        "Hospedaje con desayuno para {accommodation} en {roomType} del {arrival} al {departure} ({nights}).",
      includedServices: [
        "Desayuno buffet AC Kitchen",
        "Wi-Fi de alta velocidad",
        "Acceso a gimnasio y piscina",
        "Estacionamiento en el hotel",
      ],
      hotelInfo: "AC Hotel · Punta Pacífica, Ciudad de Panamá · +507 297-0000",
      signature: "Departamento de Reservas\nAC Hotel\nreservas@achotelpanama.com",
    },
    en: {
      intro:
        "Dear guest, thank you for your interest in AC Hotel. Please find below our accommodation quotation according to the requested dates and conditions.",
      descriptionTemplate:
        "Accommodation with breakfast for {accommodation} in {roomType} from {arrival} to {departure} ({nights}).",
      includedServices: [
        "AC Kitchen buffet breakfast",
        "High-speed Wi-Fi",
        "Fitness center and pool access",
        "On-site parking",
      ],
      hotelInfo: "AC Hotel · Punta Pacifica, Panama City · +507 297-0000",
      signature: "Reservations Department\nAC Hotel\nreservations@achotelpanama.com",
    },
  },
  {
    id: "marriott-finisterre",
    name: "Marriott Executive Apartments Panamá City – Finisterre",
    shortName: "Marriott Executive Apartments",
    address: "Calle 51 Este, Bella Vista, Ciudad de Panamá, Panamá",
    accent: "#582C35",
    secondary: "#8f6b73",
    tint: "#F8F3F4",
    roomTypes: [
      "Studio Apartment",
      "One Bedroom Apartment",
      "Two Bedroom Apartment",
      "Executive Suite",
    ],
    accommodations: ACCOMMODATIONS,
    checkIn: "16:00",
    checkOut: "12:00",
    taxRate: 0.1,
    taxLabel: "ITBMS (10%)",
    es: {
      intro:
        "Gracias por considerar Marriott Executive Apartments Panamá City – Finisterre para su estadía de larga duración. Detallamos a continuación nuestra propuesta.",
      descriptionTemplate:
        "Apartamento con desayuno para {accommodation} en {roomType} del {arrival} al {departure} ({nights}).",
      includedServices: [
        "Desayuno diario",
        "Cocina completamente equipada",
        "Servicio de limpieza diario",
        "Lavandería en la unidad",
        "Wi-Fi y gimnasio 24 horas",
      ],
      hotelInfo:
        "Marriott Executive Apartments Finisterre · Calle 51 Este, Bella Vista · +507 214-0300",
      signature:
        "Ventas Corporativas\nMarriott Executive Apartments Finisterre\nventas@finisterre.com",
    },
    en: {
      intro:
        "Thank you for considering Marriott Executive Apartments Panama City – Finisterre for your extended stay. Please find our proposal below.",
      descriptionTemplate:
        "Apartment with breakfast for {accommodation} in {roomType} from {arrival} to {departure} ({nights}).",
      includedServices: [
        "Daily breakfast",
        "Fully equipped kitchen",
        "Daily housekeeping",
        "In-unit laundry",
        "Wi-Fi and 24-hour fitness center",
      ],
      hotelInfo:
        "Marriott Executive Apartments Finisterre · Calle 51 Este, Bella Vista · +507 214-0300",
      signature:
        "Corporate Sales\nMarriott Executive Apartments Finisterre\nsales@finisterre.com",
    },
  },
  {
    id: "residence-inn",
    name: "Residence Inn",
    address: "Av. Balboa, Ciudad de Panamá, Panamá",
    accent: "#4A4043",
    secondary: "#8D8D8D",
    tint: "#F6F5F5",
    roomTypes: ["Studio Suite", "One Bedroom Suite", "Two Bedroom Suite", "City View Suite"],
    accommodations: ACCOMMODATIONS,
    checkIn: "15:00",
    checkOut: "12:00",
    taxRate: 0.1,
    taxLabel: "ITBMS (10%)",
    es: {
      intro:
        "Nos complace presentarle nuestra propuesta de hospedaje en Residence Inn, ideal para estadías prolongadas con todas las comodidades del hogar.",
      descriptionTemplate:
        "Suite con desayuno para {accommodation} en {roomType} del {arrival} al {departure} ({nights}).",
      includedServices: [
        "Desayuno caliente incluido",
        "Cocina en la suite",
        "Lavandería de huéspedes sin costo",
        "Wi-Fi en todas las áreas",
      ],
      hotelInfo: "Residence Inn · Av. Balboa, Ciudad de Panamá · +507 300-1000",
      signature: "Reservas\nResidence Inn\nreservas@residenceinnpanama.com",
    },
    en: {
      intro:
        "We are pleased to present our accommodation proposal at Residence Inn, ideal for extended stays with all the comforts of home.",
      descriptionTemplate:
        "Suite with breakfast for {accommodation} in {roomType} from {arrival} to {departure} ({nights}).",
      includedServices: [
        "Complimentary hot breakfast",
        "In-suite kitchen",
        "Complimentary guest laundry",
        "Wi-Fi throughout the property",
      ],
      hotelInfo: "Residence Inn · Av. Balboa, Panama City · +507 300-1000",
      signature: "Reservations\nResidence Inn\nreservations@residenceinnpanama.com",
    },
  },
];

export const getBaseHotel = (id: string) => HOTELS.find((h) => h.id === id) ?? HOTELS[0]!;

/** Merge stored per-hotel customization over the bundled defaults. */
export function mergeHotel(
  id: string,
  overrides?: Partial<HotelTemplate>,
  logo?: string,
): HotelTemplate {
  const base = getBaseHotel(id);
  const merged: HotelTemplate = {
    ...base,
    ...(overrides ?? {}),
    es: { ...base.es, ...(overrides?.es ?? {}) },
    en: { ...base.en, ...(overrides?.en ?? {}) },
  };
  if (logo) merged.logoUrl = logo;
  return merged;
}

export const getHotel = getBaseHotel;
