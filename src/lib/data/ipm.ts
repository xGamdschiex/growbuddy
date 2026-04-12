/**
 * IPM (Integrated Pest Management) — Wissenschaftlich korrekte Schädlingsbekämpfung
 *
 * WICHTIG: Kein Neem-Öl bei consumable Cannabis (Azadirachtin-Rückstände).
 * Nur zugelassene, sichere Methoden.
 */

export interface IPMSolution {
	name: string;
	type: 'beneficial' | 'biological' | 'mechanical' | 'cultural';
	product?: string;
	note: string;
	safe_in_flower: boolean;
}

export interface PestEntry {
	id: string;
	name: string;
	german: string;
	symptoms: string[];
	solutions: IPMSolution[];
	prevention: string[];
}

export const PESTS: PestEntry[] = [
	{
		id: 'spider-mites',
		name: 'Spider Mites',
		german: 'Spinnmilben',
		symptoms: [
			'Kleine weiße/gelbe Punkte auf Blattoberseite',
			'Feine Spinnweben zwischen Blättern',
			'Blätter werden gelb und fallen ab',
		],
		solutions: [
			{ name: 'Phytoseiulus persimilis', type: 'beneficial', note: 'Raubmilbe, frisst alle Stadien', safe_in_flower: true },
			{ name: 'Amblyseius californicus', type: 'beneficial', note: 'Präventiv + kurativ, überlebt ohne Beute', safe_in_flower: true },
			{ name: 'Kaliseife', type: 'biological', product: 'Neudosan', note: 'Nur in Veg! Nicht in der Blüte sprühen', safe_in_flower: false },
			{ name: 'Beauveria bassiana', type: 'biological', product: 'Naturalis-L', note: 'Entomopathogener Pilz, infiziert Milben. Sicher bis kurz vor Ernte', safe_in_flower: true },
		],
		prevention: ['RH 55-65% in Veg halten', 'Luftzirkulation sicherstellen', 'Neue Pflanzen in Quarantäne'],
	},
	{
		id: 'thrips',
		name: 'Thrips',
		german: 'Thripse',
		symptoms: [
			'Silbrige/bronzefarbene Streifen auf Blättern',
			'Schwarze Kotpunkte auf Blattunterseite',
			'Blätter kräuseln sich',
		],
		solutions: [
			{ name: 'Amblyseius swirskii', type: 'beneficial', note: 'Raubmilbe gegen Larven', safe_in_flower: true },
			{ name: 'Orius laevigatus', type: 'beneficial', note: 'Raubwanze, sehr effektiv', safe_in_flower: true },
			{ name: 'Spinosad', type: 'biological', product: 'SpinTor', note: 'Min. 3 Tage Karenzzeit vor Ernte', safe_in_flower: false },
			{ name: 'Beauveria bassiana', type: 'biological', product: 'Naturalis-L', note: 'Entomopathogener Pilz, wirksam gegen Thripse-Larven', safe_in_flower: true },
		],
		prevention: ['Gelbtafeln zur Früherkennung', 'Bodenbewohner (Hypoaspis) gegen Puppen', 'Pflanzenreste entfernen'],
	},
	{
		id: 'fungus-gnats',
		name: 'Fungus Gnats',
		german: 'Trauermücken',
		symptoms: [
			'Kleine schwarze Fliegen an der Erdoberfläche',
			'Larven (weiß, glasig) im Substrat sichtbar',
			'Junge Pflanzen kümmern, Wurzelschäden',
		],
		solutions: [
			{ name: 'Hypoaspis miles', type: 'beneficial', note: 'Raubmilbe im Boden gegen Larven', safe_in_flower: true },
			{ name: 'Steinernema feltiae', type: 'biological', note: 'Nematoden zum Gießen', safe_in_flower: true },
			{ name: 'Bacillus thuringiensis israelensis (Bti)', type: 'biological', product: 'Mosquito Bits', note: 'Zum Gießwasser, sicher bis Ernte', safe_in_flower: true },
			{ name: 'Gelbtafeln', type: 'mechanical', note: 'Fangen erwachsene Mücken', safe_in_flower: true },
		],
		prevention: ['Substrat zwischen Gießen abtrocknen lassen', 'Sand/Perlite auf Erdoberfläche', 'Keine organischen Mulch-Schichten'],
	},
	{
		id: 'whiteflies',
		name: 'Whiteflies',
		german: 'Weiße Fliege',
		symptoms: [
			'Kleine weiße Fliegen auf Blattunterseite',
			'Honigtau (klebriger Belag) auf Blättern',
			'Rußtaupilz auf Honigtau',
		],
		solutions: [
			{ name: 'Amblyseius swirskii', type: 'beneficial', note: 'Gegen Eier und Larven', safe_in_flower: true },
			{ name: 'Encarsia formosa', type: 'beneficial', note: 'Schlupfwespe, parasitiert Larven', safe_in_flower: true },
			{ name: 'Kaliseife', type: 'biological', product: 'Neudosan', note: 'Nur in Veg', safe_in_flower: false },
			{ name: 'Beauveria bassiana', type: 'biological', product: 'Naturalis-L', note: 'Entomopathogener Pilz gegen Weiße Fliege', safe_in_flower: true },
		],
		prevention: ['Gelbtafeln', 'Luftzirkulation', 'Befallene Blätter sofort entfernen'],
	},
	{
		id: 'aphids',
		name: 'Aphids',
		german: 'Blattläuse',
		symptoms: [
			'Kleine grüne/schwarze Insekten auf Triebspitzen',
			'Honigtau auf Blättern',
			'Gekräuselte neue Blätter',
		],
		solutions: [
			{ name: 'Chrysoperla carnea', type: 'beneficial', note: 'Florfliegenlarven — Generalisten', safe_in_flower: true },
			{ name: 'Aphidius colemani', type: 'beneficial', note: 'Schlupfwespe gegen Blattläuse', safe_in_flower: true },
			{ name: 'Kaliseife', type: 'biological', product: 'Neudosan', note: 'Nur in Veg sprühen', safe_in_flower: false },
		],
		prevention: ['Regelmäßige Inspektion neuer Triebe', 'Keine Überdüngung mit N', 'Ameisen fernhalten (verbreiten Läuse)'],
	},
	{
		id: 'powdery-mildew',
		name: 'Powdery Mildew',
		german: 'Echter Mehltau',
		symptoms: [
			'Weißer, pudriger Belag auf Blattoberseite',
			'Breitet sich schnell bei hoher RH und schlechter Luftzirkulation aus',
		],
		solutions: [
			{ name: 'Bacillus amyloliquefaciens', type: 'biological', product: 'Serenade', note: 'Biologisches Fungizid, sicher', safe_in_flower: true },
			{ name: 'Kaliumbicarbonat', type: 'biological', note: 'Ändert pH auf Blattoberfläche', safe_in_flower: false },
			{ name: 'Befallene Blätter entfernen', type: 'mechanical', note: 'Sofort in Tüte, nicht im Grow-Raum', safe_in_flower: true },
		],
		prevention: ['RH < 55% in Blüte', 'Gute Luftzirkulation', 'Defoliation für Luftdurchlässigkeit', 'Resistente Genetik wählen'],
	},
	{
		id: 'botrytis',
		name: 'Botrytis (Bud Rot)',
		german: 'Grauschimmel / Knospenfäule',
		symptoms: [
			'Braune, matschige Stellen in dichten Buds',
			'Grauer Schimmelbelag',
			'Einzelne Blätter an der Bud werden gelb/braun',
		],
		solutions: [
			{ name: 'Befallene Buds sofort entfernen', type: 'mechanical', note: '2cm über/unter dem Befall schneiden. In Tüte, nicht schütteln!', safe_in_flower: true },
			{ name: 'Bacillus subtilis', type: 'biological', note: 'Präventiv, nicht kurativ', safe_in_flower: true },
		],
		prevention: ['RH < 50% in später Blüte', 'Gute Luftzirkulation (Oszillierende Ventilatoren)', 'Nicht zu dicht pflanzen', 'Outdoor: Regenschutz in Blüte'],
	},
	{
		id: 'caterpillars',
		name: 'Caterpillars',
		german: 'Raupen',
		symptoms: [
			'Fraßspuren an Blättern',
			'Kot (kleine schwarze Kügelchen) auf Blättern',
			'Raupen in Buds versteckt → Budrot-Gefahr',
		],
		solutions: [
			{ name: 'Bacillus thuringiensis (Bt)', type: 'biological', product: 'Dipel, XenTari', note: 'Sicher bis Ernte, spezifisch gegen Raupen', safe_in_flower: true },
			{ name: 'Trichogramma', type: 'beneficial', note: 'Schlupfwespen parasitieren Eier', safe_in_flower: true },
			{ name: 'Manuelles Absammeln', type: 'mechanical', note: 'Täglich kontrollieren', safe_in_flower: true },
		],
		prevention: ['Insektenschutznetz outdoor', 'Regelmäßige Kontrolle', 'Bt präventiv alle 7-10 Tage'],
	},
];

export function getPest(id: string): PestEntry | undefined {
	return PESTS.find(p => p.id === id);
}
