"""
Drug Interaction Checker.
Rule-based system with 50+ known drug interaction pairs.
"""

# Severity levels: mild, moderate, severe
INTERACTIONS = [
    # Cardiovascular + other drugs
    ('warfarin', 'aspirin', 'severe', 'Increased bleeding risk. Avoid combination unless directed.'),
    ('warfarin', 'ibuprofen', 'severe', 'NSAIDs increase anticoagulant effect and bleeding risk.'),
    ('warfarin', 'naproxen', 'severe', 'NSAIDs increase anticoagulant effect and bleeding risk.'),
    ('warfarin', 'fluoxetine', 'moderate', 'SSRIs may enhance anticoagulant effect of warfarin.'),
    ('warfarin', 'amoxicillin', 'moderate', 'Antibiotics may alter vitamin K metabolism.'),
    ('warfarin', 'metronidazole', 'severe', 'Metronidazole significantly increases warfarin effect.'),
    ('lisinopril', 'losartan', 'moderate', 'Dual RAAS blockade increases risk of hypotension.'),
    ('lisinopril', 'potassium', 'moderate', 'ACE inhibitors + potassium may cause hyperkalemia.'),
    ('amlodipine', 'simvastatin', 'moderate', 'Risk of rhabdomyolysis. Limit simvastatin dose.'),
    ('metoprolol', 'verapamil', 'severe', 'Risk of severe bradycardia and heart block.'),
    ('clopidogrel', 'omeprazole', 'moderate', 'Omeprazole reduces clopidogrel efficacy.'),
    ('clopidogrel', 'aspirin', 'moderate', 'Increased bleeding risk; monitor closely.'),
    # Diabetes medications
    ('metformin', 'alcohol', 'severe', 'Risk of lactic acidosis.'),
    ('metformin', 'contrast dye', 'severe', 'Hold metformin 48h before/after contrast.'),
    ('glipizide', 'fluconazole', 'moderate', 'Risk of severe hypoglycemia.'),
    ('insulin', 'metformin', 'mild', 'Monitor blood glucose closely when combining.'),
    ('insulin', 'prednisone', 'moderate', 'Steroids can increase blood sugar significantly.'),
    # Antibiotics
    ('amoxicillin', 'methotrexate', 'severe', 'Reduced methotrexate clearance.'),
    ('ciprofloxacin', 'iron', 'moderate', 'Iron reduces ciprofloxacin absorption. Space 2h apart.'),
    ('ciprofloxacin', 'calcium', 'moderate', 'Calcium reduces absorption. Space 2h apart.'),
    ('azithromycin', 'warfarin', 'moderate', 'May enhance anticoagulant effect.'),
    ('metronidazole', 'alcohol', 'severe', 'Disulfiram-like reaction. Avoid alcohol.'),
    ('doxycycline', 'calcium', 'moderate', 'Calcium reduces absorption significantly.'),
    ('doxycycline', 'iron', 'moderate', 'Iron reduces absorption. Space 2-3h apart.'),
    # Pain medications
    ('ibuprofen', 'aspirin', 'moderate', 'NSAIDs may reduce cardioprotective effect of aspirin.'),
    ('ibuprofen', 'naproxen', 'moderate', 'Avoid combining NSAIDs. Increased GI bleeding risk.'),
    ('ibuprofen', 'lisinopril', 'moderate', 'NSAIDs may reduce antihypertensive effect.'),
    ('ibuprofen', 'methotrexate', 'severe', 'NSAIDs reduce methotrexate clearance.'),
    ('tramadol', 'sertraline', 'severe', 'Risk of serotonin syndrome.'),
    ('tramadol', 'fluoxetine', 'severe', 'Risk of serotonin syndrome.'),
    ('tramadol', 'escitalopram', 'severe', 'Risk of serotonin syndrome.'),
    # Mental health
    ('sertraline', 'tramadol', 'severe', 'Risk of serotonin syndrome.'),
    ('fluoxetine', 'alprazolam', 'moderate', 'Fluoxetine increases alprazolam levels.'),
    ('escitalopram', 'aspirin', 'moderate', 'Increased bleeding risk.'),
    ('diazepam', 'alcohol', 'severe', 'CNS depression. Avoid combination.'),
    ('alprazolam', 'alcohol', 'severe', 'CNS depression. Avoid combination.'),
    # GI medications
    ('omeprazole', 'clopidogrel', 'moderate', 'Omeprazole reduces clopidogrel activation.'),
    ('omeprazole', 'iron', 'mild', 'PPIs reduce iron absorption.'),
    ('omeprazole', 'calcium', 'mild', 'Long-term PPI use may reduce calcium absorption.'),
    ('omeprazole', 'vitamin b12', 'mild', 'Long-term PPIs may reduce B12 absorption.'),
    # Thyroid
    ('levothyroxine', 'calcium', 'moderate', 'Calcium reduces levothyroxine absorption. Space 4h.'),
    ('levothyroxine', 'iron', 'moderate', 'Iron reduces levothyroxine absorption. Space 4h.'),
    ('levothyroxine', 'omeprazole', 'moderate', 'PPIs may reduce levothyroxine absorption.'),
    # Steroids
    ('prednisone', 'ibuprofen', 'moderate', 'Increased GI bleeding risk.'),
    ('prednisone', 'aspirin', 'moderate', 'Increased GI bleeding risk.'),
    ('prednisone', 'insulin', 'moderate', 'Steroids increase blood sugar levels.'),
    ('dexamethasone', 'warfarin', 'moderate', 'May alter warfarin effect.'),
    # Supplements
    ('calcium', 'iron', 'mild', 'Calcium reduces iron absorption. Take separately.'),
    ('iron', 'calcium', 'mild', 'Take iron and calcium at least 2h apart.'),
    ('vitamin c', 'iron', 'mild', 'Vitamin C enhances iron absorption (positive interaction).'),
]


def check_interactions(medicine_names):
    """
    Check drug interactions for a list of medicine names.
    Returns list of interaction warnings.
    """
    names_lower = [n.lower().strip() for n in medicine_names]
    warnings = []

    for drug_a, drug_b, severity, desc in INTERACTIONS:
        if drug_a in names_lower and drug_b in names_lower:
            warnings.append({
                'drug_a': drug_a.title(),
                'drug_b': drug_b.title(),
                'severity': severity,
                'description': desc,
            })

    # Deduplicate (A+B == B+A)
    seen = set()
    unique = []
    for w in warnings:
        key = tuple(sorted([w['drug_a'].lower(), w['drug_b'].lower()]))
        if key not in seen:
            seen.add(key)
            unique.append(w)

    # Sort: severe first
    order = {'severe': 0, 'moderate': 1, 'mild': 2}
    unique.sort(key=lambda x: order.get(x['severity'], 3))

    return unique


def check_new_medicine(new_medicine_name, existing_medicine_names):
    """
    Check if adding a new medicine creates interactions with existing ones.
    """
    all_names = existing_medicine_names + [new_medicine_name]
    all_interactions = check_interactions(all_names)

    # Filter to only interactions involving the new medicine
    nm_lower = new_medicine_name.lower().strip()
    relevant = [w for w in all_interactions
                if w['drug_a'].lower() == nm_lower or w['drug_b'].lower() == nm_lower]

    return relevant
