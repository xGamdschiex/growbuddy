/**
 * GrowBuddy — Strain-Datenbank
 * Top 50 Cannabis-Strains mit Grow-Parametern.
 * Quellen: Seedfinder.eu, Royal Queen Seeds, Barney's Farm, Dutch Passion Datenblätter.
 */

export type StrainType = 'auto' | 'photo';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface StrainDef {
	id: string;
	name: string;
	breeder: string;
	type: StrainType;
	genetics: string;        // z.B. "Indica 70% / Sativa 30%"
	difficulty: Difficulty;
	/** Blütezeit in Wochen (Photo) oder Gesamtdauer Samen→Ernte in Wochen (Auto) */
	flower_weeks: number;
	/** Optimaler EC-Bereich Blüte (mS/cm) */
	ec_bloom_min: number;
	ec_bloom_max: number;
	/** Optimaler pH */
	ph_min: number;
	ph_max: number;
	/** Erwarteter Yield Indoor g/m² */
	yield_indoor: number;
	/** Erwarteter Yield Outdoor g/Pflanze */
	yield_outdoor: number;
	/** Höhe Indoor (cm) */
	height_min: number;
	height_max: number;
	/** THC % Bereich */
	thc_min: number;
	thc_max: number;
	/** Empfohlene Techniken */
	techniques: string[];
	/** Kurze Beschreibung */
	desc_de: string;
	desc_en: string;
}

export const STRAINS: StrainDef[] = [
	// ─── PHOTO CLASSICS ─────────────────────────────────────────
	{ id: 'white-widow', name: 'White Widow', breeder: 'Dutch Passion', type: 'photo', genetics: 'Indica 60% / Sativa 40%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 5.8, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 60, height_max: 100, thc_min: 18, thc_max: 22, techniques: ['LST', 'SCRoG'], desc_de: 'Der Klassiker — robust, verzeihend, guter Ertrag für Anfänger.', desc_en: 'The classic — robust, forgiving, good yield for beginners.' },
	{ id: 'northern-lights', name: 'Northern Lights', breeder: 'Sensi Seeds', type: 'photo', genetics: 'Indica 95% / Sativa 5%', difficulty: 'easy', flower_weeks: 7, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 80, height_max: 130, thc_min: 16, thc_max: 21, techniques: ['SOG'], desc_de: 'Indischer Klassiker — kompakt, wenig Geruch, schnelle Blüte.', desc_en: 'Indian classic — compact, low odor, fast flowering.' },
	{ id: 'gorilla-glue', name: 'Gorilla Glue #4', breeder: 'Original Glue', type: 'photo', genetics: 'Indica 50% / Sativa 50%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.6, ec_bloom_max: 2.2, ph_min: 5.8, ph_max: 6.3, yield_indoor: 550, yield_outdoor: 700, height_min: 80, height_max: 150, thc_min: 24, thc_max: 30, techniques: ['LST', 'Topping'], desc_de: 'Extrem potent, klebrige Buds. Braucht gute Belüftung.', desc_en: 'Extremely potent, sticky buds. Needs good ventilation.' },
	{ id: 'blue-dream', name: 'Blue Dream', breeder: 'Humboldt Seeds', type: 'photo', genetics: 'Indica 40% / Sativa 60%', difficulty: 'easy', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 550, yield_outdoor: 700, height_min: 100, height_max: 180, thc_min: 17, thc_max: 24, techniques: ['SCRoG', 'Topping'], desc_de: 'Sativa-dominant, fruchtig, gleichmäßiger Grow.', desc_en: 'Sativa-dominant, fruity, even grow.' },
	{ id: 'skunk-1', name: 'Skunk #1', breeder: 'Sensi Seeds', type: 'photo', genetics: 'Indica 65% / Sativa 35%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 550, height_min: 80, height_max: 120, thc_min: 15, thc_max: 19, techniques: ['SOG', 'LST'], desc_de: 'Die Mutter aller Hybriden — stabil, zuverlässig.', desc_en: 'Mother of all hybrids — stable, reliable.' },
	{ id: 'og-kush', name: 'OG Kush', breeder: 'DNA Genetics', type: 'photo', genetics: 'Indica 75% / Sativa 25%', difficulty: 'medium', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 5.8, ph_max: 6.3, yield_indoor: 450, yield_outdoor: 500, height_min: 90, height_max: 160, thc_min: 19, thc_max: 26, techniques: ['LST', 'Topping'], desc_de: 'Kalifornischer Klassiker, starker Geruch, empfindlich gegen Schimmel.', desc_en: 'California classic, strong smell, mold sensitive.' },
	{ id: 'girl-scout-cookies', name: 'Girl Scout Cookies', breeder: 'Cookie Fam', type: 'photo', genetics: 'Indica 60% / Sativa 40%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 450, yield_outdoor: 500, height_min: 80, height_max: 140, thc_min: 22, thc_max: 28, techniques: ['LST', 'SCRoG'], desc_de: 'Süße Terpene, hoher THC, kompakter Wuchs.', desc_en: 'Sweet terpenes, high THC, compact growth.' },
	{ id: 'gelato', name: 'Gelato #41', breeder: 'Cookies', type: 'photo', genetics: 'Indica 55% / Sativa 45%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.6, ec_bloom_max: 2.2, ph_min: 5.8, ph_max: 6.3, yield_indoor: 500, yield_outdoor: 550, height_min: 80, height_max: 140, thc_min: 20, thc_max: 25, techniques: ['LST', 'Topping'], desc_de: 'Dessert-Terpene, Purple Phänotypen möglich.', desc_en: 'Dessert terpenes, purple phenotypes possible.' },
	{ id: 'amnesia-haze', name: 'Amnesia Haze', breeder: 'Royal Queen Seeds', type: 'photo', genetics: 'Indica 20% / Sativa 80%', difficulty: 'hard', flower_weeks: 11, ec_bloom_min: 1.6, ec_bloom_max: 2.2, ph_min: 6.0, ph_max: 6.5, yield_indoor: 600, yield_outdoor: 700, height_min: 120, height_max: 200, thc_min: 20, thc_max: 25, techniques: ['SCRoG', 'Topping', 'Super Cropping'], desc_de: 'Lange Blüte, riesiger Ertrag. Nur für geduldige Grower.', desc_en: 'Long flowering, huge yield. Only for patient growers.' },
	{ id: 'wedding-cake', name: 'Wedding Cake', breeder: 'Seed Junky', type: 'photo', genetics: 'Indica 60% / Sativa 40%', difficulty: 'medium', flower_weeks: 8, ec_bloom_min: 1.6, ec_bloom_max: 2.0, ph_min: 5.8, ph_max: 6.3, yield_indoor: 500, yield_outdoor: 550, height_min: 80, height_max: 130, thc_min: 22, thc_max: 27, techniques: ['LST'], desc_de: 'Trichom-Monster, vanillige Terpene.', desc_en: 'Trichome monster, vanilla terpenes.' },
	{ id: 'jack-herer', name: 'Jack Herer', breeder: 'Sensi Seeds', type: 'photo', genetics: 'Indica 45% / Sativa 55%', difficulty: 'medium', flower_weeks: 10, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 100, height_max: 180, thc_min: 18, thc_max: 23, techniques: ['SCRoG'], desc_de: 'Legendäre Sativa, euphorisches High. Braucht Höhe.', desc_en: 'Legendary sativa, euphoric high. Needs height.' },
	{ id: 'critical-mass', name: 'Critical Mass', breeder: "Mr. Nice Seeds", type: 'photo', genetics: 'Indica 80% / Sativa 20%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 650, yield_outdoor: 800, height_min: 80, height_max: 120, thc_min: 19, thc_max: 22, techniques: ['SOG', 'LST'], desc_de: 'Maximaler Ertrag, schwere Buds. Stützen nötig!', desc_en: 'Maximum yield, heavy buds. Support needed!' },
	{ id: 'zkittlez', name: 'Zkittlez', breeder: 'Dying Breed', type: 'photo', genetics: 'Indica 70% / Sativa 30%', difficulty: 'medium', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 450, yield_outdoor: 500, height_min: 70, height_max: 120, thc_min: 20, thc_max: 24, techniques: ['LST'], desc_de: 'Fruchtig-süß, bunte Buds, kompakter Wuchs.', desc_en: 'Fruity-sweet, colorful buds, compact growth.' },
	{ id: 'cheese', name: 'Cheese', breeder: 'Big Buddha Seeds', type: 'photo', genetics: 'Indica 60% / Sativa 40%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 80, height_max: 130, thc_min: 17, thc_max: 21, techniques: ['LST', 'SOG'], desc_de: 'UK-Klassiker, käsiges Aroma, sehr robust.', desc_en: 'UK classic, cheesy aroma, very robust.' },
	{ id: 'sour-diesel', name: 'Sour Diesel', breeder: 'Reserva Privada', type: 'photo', genetics: 'Indica 30% / Sativa 70%', difficulty: 'hard', flower_weeks: 10, ec_bloom_min: 1.6, ec_bloom_max: 2.2, ph_min: 6.0, ph_max: 6.5, yield_indoor: 550, yield_outdoor: 650, height_min: 120, height_max: 200, thc_min: 19, thc_max: 25, techniques: ['SCRoG', 'Super Cropping'], desc_de: 'Diesel-Aroma, energetisches High. Wird groß!', desc_en: 'Diesel aroma, energetic high. Grows tall!' },

	// ─── AUTOS ──────────────────────────────────────────────────
	{ id: 'auto-northern-lights', name: 'Northern Lights Auto', breeder: 'Royal Queen Seeds', type: 'auto', genetics: 'Indica 90% / Sativa 10%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 350, yield_outdoor: 150, height_min: 60, height_max: 90, thc_min: 14, thc_max: 18, techniques: ['LST'], desc_de: 'Perfekter Einstieg — klein, schnell, robust.', desc_en: 'Perfect entry — small, fast, robust.' },
	{ id: 'auto-gorilla-glue', name: 'Gorilla Glue Auto', breeder: "Barney's Farm", type: 'auto', genetics: 'Indica 60% / Sativa 40%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 5.8, ph_max: 6.3, yield_indoor: 400, yield_outdoor: 200, height_min: 70, height_max: 100, thc_min: 20, thc_max: 24, techniques: ['LST'], desc_de: 'Potente Auto, guter Ertrag für die Größe.', desc_en: 'Potent auto, good yield for the size.' },
	{ id: 'auto-white-widow', name: 'White Widow Auto', breeder: 'Dutch Passion', type: 'auto', genetics: 'Indica 60% / Sativa 40%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 350, yield_outdoor: 150, height_min: 50, height_max: 80, thc_min: 15, thc_max: 19, techniques: ['LST'], desc_de: 'Zuverlässige Auto-Version des Klassikers.', desc_en: 'Reliable auto version of the classic.' },
	{ id: 'auto-blueberry', name: 'Blueberry Auto', breeder: 'Dutch Passion', type: 'auto', genetics: 'Indica 80% / Sativa 20%', difficulty: 'easy', flower_weeks: 9, ec_bloom_min: 1.0, ec_bloom_max: 1.4, ph_min: 6.0, ph_max: 6.5, yield_indoor: 300, yield_outdoor: 120, height_min: 50, height_max: 75, thc_min: 14, thc_max: 18, techniques: ['LST'], desc_de: 'Beerig-süß, kompakt, schöne Farben.', desc_en: 'Berry-sweet, compact, beautiful colors.' },
	{ id: 'auto-amnesia', name: 'Amnesia Haze Auto', breeder: 'Royal Queen Seeds', type: 'auto', genetics: 'Indica 30% / Sativa 70%', difficulty: 'medium', flower_weeks: 11, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 400, yield_outdoor: 170, height_min: 70, height_max: 110, thc_min: 16, thc_max: 20, techniques: ['LST'], desc_de: 'Sativa-Auto mit überraschend gutem Ertrag.', desc_en: 'Sativa auto with surprisingly good yield.' },
	{ id: 'auto-critical', name: 'Critical Auto', breeder: 'Royal Queen Seeds', type: 'auto', genetics: 'Indica 75% / Sativa 25%', difficulty: 'easy', flower_weeks: 9, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 400, yield_outdoor: 175, height_min: 60, height_max: 90, thc_min: 14, thc_max: 18, techniques: ['LST'], desc_de: 'Schwere Ernte, einfacher Grow.', desc_en: 'Heavy harvest, easy grow.' },
	{ id: 'auto-jack-herer', name: 'Jack Herer Auto', breeder: 'Dutch Passion', type: 'auto', genetics: 'Indica 40% / Sativa 60%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 350, yield_outdoor: 150, height_min: 60, height_max: 100, thc_min: 15, thc_max: 20, techniques: ['LST'], desc_de: 'Sativa-Kick als Auto-Variante.', desc_en: 'Sativa kick as auto variant.' },
	{ id: 'auto-gelato', name: 'Gelato Auto', breeder: "Barney's Farm", type: 'auto', genetics: 'Indica 55% / Sativa 45%', difficulty: 'medium', flower_weeks: 10, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 5.8, ph_max: 6.3, yield_indoor: 400, yield_outdoor: 180, height_min: 70, height_max: 100, thc_min: 18, thc_max: 23, techniques: ['LST'], desc_de: 'Dessert-Terpene, Purple Phäno bei Kälte.', desc_en: 'Dessert terpenes, purple pheno with cold.' },
	{ id: 'auto-zkittlez', name: 'Zkittlez Auto', breeder: 'FastBuds', type: 'auto', genetics: 'Indica 65% / Sativa 35%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 400, yield_outdoor: 170, height_min: 60, height_max: 90, thc_min: 18, thc_max: 23, techniques: ['LST'], desc_de: 'Bunte Buds, Frucht-Explosion, einfach zu growen.', desc_en: 'Colorful buds, fruit explosion, easy to grow.' },
	{ id: 'auto-wedding-cake', name: 'Wedding Cake Auto', breeder: 'FastBuds', type: 'auto', genetics: 'Indica 55% / Sativa 45%', difficulty: 'medium', flower_weeks: 10, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 5.8, ph_max: 6.3, yield_indoor: 450, yield_outdoor: 200, height_min: 70, height_max: 110, thc_min: 20, thc_max: 25, techniques: ['LST'], desc_de: 'Ertragreiche Auto, cremiges Aroma.', desc_en: 'High-yielding auto, creamy aroma.' },

	// ─── WEITERE PHOTOS ─────────────────────────────────────────
	{ id: 'bruce-banner', name: 'Bruce Banner #3', breeder: 'Dark Horse Genetics', type: 'photo', genetics: 'Indica 40% / Sativa 60%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.6, ec_bloom_max: 2.2, ph_min: 5.8, ph_max: 6.3, yield_indoor: 550, yield_outdoor: 600, height_min: 100, height_max: 170, thc_min: 24, thc_max: 30, techniques: ['SCRoG', 'Topping'], desc_de: 'Einer der stärksten Strains überhaupt.', desc_en: 'One of the strongest strains ever.' },
	{ id: 'purple-punch', name: 'Purple Punch', breeder: 'Symbiotic Genetics', type: 'photo', genetics: 'Indica 80% / Sativa 20%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 450, yield_outdoor: 500, height_min: 70, height_max: 110, thc_min: 18, thc_max: 24, techniques: ['LST'], desc_de: 'Trauben-Vanille Terpene, deep purple Buds.', desc_en: 'Grape-vanilla terpenes, deep purple buds.' },
	{ id: 'runtz', name: 'Runtz', breeder: 'Cookies', type: 'photo', genetics: 'Indica 50% / Sativa 50%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 5.8, ph_max: 6.3, yield_indoor: 450, yield_outdoor: 500, height_min: 80, height_max: 130, thc_min: 22, thc_max: 28, techniques: ['LST', 'Topping'], desc_de: 'Candy-Terpene, bunte Buds, very hyped.', desc_en: 'Candy terpenes, colorful buds, very hyped.' },
	{ id: 'mimosa', name: 'Mimosa', breeder: 'Symbiotic Genetics', type: 'photo', genetics: 'Indica 30% / Sativa 70%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 100, height_max: 160, thc_min: 19, thc_max: 24, techniques: ['SCRoG'], desc_de: 'Zitronen-Orangen Aroma, energetisch, guter Ertrag.', desc_en: 'Lemon-orange aroma, energetic, good yield.' },
	{ id: 'do-si-dos', name: 'Do-Si-Dos', breeder: 'Archive Seeds', type: 'photo', genetics: 'Indica 70% / Sativa 30%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 5.8, ph_max: 6.3, yield_indoor: 500, yield_outdoor: 550, height_min: 80, height_max: 130, thc_min: 22, thc_max: 28, techniques: ['LST', 'Topping'], desc_de: 'Minzig-erdig, starke Indica-Wirkung.', desc_en: 'Minty-earthy, strong indica effect.' },
	{ id: 'granddaddy-purple', name: 'Granddaddy Purple', breeder: 'Ken Estes', type: 'photo', genetics: 'Indica 80% / Sativa 20%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 450, yield_outdoor: 500, height_min: 70, height_max: 120, thc_min: 17, thc_max: 23, techniques: ['LST'], desc_de: 'Tiefviolette Buds, Trauben-Aroma, entspannend.', desc_en: 'Deep purple buds, grape aroma, relaxing.' },
	{ id: 'pineapple-express', name: 'Pineapple Express', breeder: "Barney's Farm", type: 'photo', genetics: 'Indica 40% / Sativa 60%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 100, height_max: 160, thc_min: 18, thc_max: 24, techniques: ['LST', 'SCRoG'], desc_de: 'Tropisches Aroma, energetisch, easy Grow.', desc_en: 'Tropical aroma, energetic, easy grow.' },
	{ id: 'strawberry-cough', name: 'Strawberry Cough', breeder: 'Dutch Passion', type: 'photo', genetics: 'Indica 20% / Sativa 80%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 450, yield_outdoor: 500, height_min: 100, height_max: 170, thc_min: 18, thc_max: 23, techniques: ['SCRoG'], desc_de: 'Erdbeer-Aroma, kräftiger Sativa-Kick.', desc_en: 'Strawberry aroma, strong sativa kick.' },
	{ id: 'ak47', name: 'AK-47', breeder: 'Serious Seeds', type: 'photo', genetics: 'Indica 35% / Sativa 65%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 80, height_max: 140, thc_min: 17, thc_max: 22, techniques: ['LST', 'SOG'], desc_de: 'Mehrfacher Cup-Gewinner, balanced High.', desc_en: 'Multiple cup winner, balanced high.' },
	{ id: 'trainwreck', name: 'Trainwreck', breeder: 'Greenhouse Seeds', type: 'photo', genetics: 'Indica 35% / Sativa 65%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 6.0, ph_max: 6.5, yield_indoor: 500, yield_outdoor: 600, height_min: 100, height_max: 170, thc_min: 18, thc_max: 25, techniques: ['SCRoG', 'Topping'], desc_de: 'Schnelles Sativa-High, zitronig-scharf.', desc_en: 'Fast sativa high, lemon-spicy.' },
	{ id: 'bubba-kush', name: 'Bubba Kush', breeder: 'Greenhouse Seeds', type: 'photo', genetics: 'Indica 80% / Sativa 20%', difficulty: 'easy', flower_weeks: 8, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 6.0, ph_max: 6.5, yield_indoor: 400, yield_outdoor: 450, height_min: 60, height_max: 100, thc_min: 15, thc_max: 22, techniques: ['LST', 'SOG'], desc_de: 'Kaffee-Schokoladen Terpene, Couchlock-Indica.', desc_en: 'Coffee-chocolate terpenes, couchlock indica.' },
	{ id: 'mac1', name: 'MAC #1', breeder: 'Capulator', type: 'photo', genetics: 'Indica 50% / Sativa 50%', difficulty: 'medium', flower_weeks: 9, ec_bloom_min: 1.4, ec_bloom_max: 2.0, ph_min: 5.8, ph_max: 6.3, yield_indoor: 450, yield_outdoor: 500, height_min: 80, height_max: 130, thc_min: 20, thc_max: 26, techniques: ['LST', 'Topping'], desc_de: 'Cremig-fruchtig, dichte Trichom-Deckung.', desc_en: 'Creamy-fruity, dense trichome coverage.' },

	// ─── WEITERE AUTOS ──────────────────────────────────────────
	{ id: 'auto-cheese', name: 'Cheese Auto', breeder: 'Royal Queen Seeds', type: 'auto', genetics: 'Indica 60% / Sativa 40%', difficulty: 'easy', flower_weeks: 9, ec_bloom_min: 1.0, ec_bloom_max: 1.4, ph_min: 6.0, ph_max: 6.5, yield_indoor: 350, yield_outdoor: 150, height_min: 50, height_max: 80, thc_min: 14, thc_max: 18, techniques: ['LST'], desc_de: 'Käsig-robust, schnelle Auto.', desc_en: 'Cheesy-robust, fast auto.' },
	{ id: 'auto-og-kush', name: 'OG Kush Auto', breeder: 'Dutch Passion', type: 'auto', genetics: 'Indica 75% / Sativa 25%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 350, yield_outdoor: 150, height_min: 60, height_max: 90, thc_min: 16, thc_max: 20, techniques: ['LST'], desc_de: 'Kush-Aroma als kompakte Auto.', desc_en: 'Kush aroma as compact auto.' },
	{ id: 'auto-bruce-banner', name: 'Bruce Banner Auto', breeder: 'FastBuds', type: 'auto', genetics: 'Indica 40% / Sativa 60%', difficulty: 'medium', flower_weeks: 11, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 5.8, ph_max: 6.3, yield_indoor: 450, yield_outdoor: 200, height_min: 80, height_max: 120, thc_min: 22, thc_max: 27, techniques: ['LST'], desc_de: 'Starke Auto — fast Photo-Level Potenz.', desc_en: 'Strong auto — nearly photo-level potency.' },
	{ id: 'auto-girl-scout-cookies', name: 'Girl Scout Cookies Auto', breeder: 'FastBuds', type: 'auto', genetics: 'Indica 60% / Sativa 40%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 400, yield_outdoor: 170, height_min: 60, height_max: 100, thc_min: 18, thc_max: 22, techniques: ['LST'], desc_de: 'Süßer Geschmack, easy Auto mit gutem Ertrag.', desc_en: 'Sweet taste, easy auto with good yield.' },
	{ id: 'auto-purple-punch', name: 'Purple Punch Auto', breeder: "Barney's Farm", type: 'auto', genetics: 'Indica 80% / Sativa 20%', difficulty: 'easy', flower_weeks: 9, ec_bloom_min: 1.0, ec_bloom_max: 1.4, ph_min: 6.0, ph_max: 6.5, yield_indoor: 350, yield_outdoor: 140, height_min: 50, height_max: 80, thc_min: 16, thc_max: 20, techniques: ['LST'], desc_de: 'Kompakte purple Buds, Trauben-Aroma.', desc_en: 'Compact purple buds, grape aroma.' },
	{ id: 'auto-blue-dream', name: 'Blue Dream Auto', breeder: 'FastBuds', type: 'auto', genetics: 'Indica 40% / Sativa 60%', difficulty: 'easy', flower_weeks: 10, ec_bloom_min: 1.0, ec_bloom_max: 1.6, ph_min: 6.0, ph_max: 6.5, yield_indoor: 400, yield_outdoor: 170, height_min: 70, height_max: 100, thc_min: 17, thc_max: 21, techniques: ['LST'], desc_de: 'Fruchtige Sativa-Auto, gleichmäßiger Grow.', desc_en: 'Fruity sativa auto, even grow.' },
	{ id: 'auto-runtz', name: 'Runtz Auto', breeder: "Barney's Farm", type: 'auto', genetics: 'Indica 50% / Sativa 50%', difficulty: 'medium', flower_weeks: 10, ec_bloom_min: 1.2, ec_bloom_max: 1.8, ph_min: 5.8, ph_max: 6.3, yield_indoor: 400, yield_outdoor: 180, height_min: 70, height_max: 100, thc_min: 19, thc_max: 24, techniques: ['LST'], desc_de: 'Candy-Terpene als Auto, trending Strain.', desc_en: 'Candy terpenes as auto, trending strain.' },
];

/** Lookup by ID */
export function getStrain(id: string): StrainDef | undefined {
	return STRAINS.find(s => s.id === id);
}

/** Search by name (case-insensitive partial match) */
export function searchStrains(query: string): StrainDef[] {
	if (!query.trim()) return STRAINS;
	const q = query.toLowerCase();
	return STRAINS.filter(s =>
		s.name.toLowerCase().includes(q) ||
		s.breeder.toLowerCase().includes(q) ||
		s.genetics.toLowerCase().includes(q)
	);
}

/** Filter by type */
export function getStrainsByType(type: StrainType): StrainDef[] {
	return STRAINS.filter(s => s.type === type);
}

/** Filter by difficulty */
export function getStrainsByDifficulty(diff: Difficulty): StrainDef[] {
	return STRAINS.filter(s => s.difficulty === diff);
}
