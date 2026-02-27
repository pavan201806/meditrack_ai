"""
Enhanced OCR Prescription Scanner v4.
- Multi-format: Indian pharmacy, pharmacy tables, handwritten, generic
- Highly lenient parser tolerant of OCR noise (merged words, missing punctuation)
- 4-value M-N-E-N dosing and 3-value morning-afternoon-night
- Contains: line extraction for active ingredients and dosage
- Multiple OCR preprocessing strategies for maximum accuracy
- Per-field confidence scoring
"""
import re
import io

try:
    import pytesseract
    from PIL import Image, ImageFilter, ImageEnhance, ImageOps
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


# ---- Medicine Database ----

KNOWN_MEDICINES = {
    'amoxicillin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'azithromycin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'ciprofloxacin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'doxycycline': {'type': 'Capsule', 'icon': 'capsule', 'cat': 'antibiotic'},
    'metronidazole': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'cephalexin': {'type': 'Capsule', 'icon': 'capsule', 'cat': 'antibiotic'},
    'clindamycin': {'type': 'Capsule', 'icon': 'capsule', 'cat': 'antibiotic'},
    'levofloxacin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'cefixime': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'crosine': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'antibiotic'},
    'lisinopril': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'amlodipine': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'losartan': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'atorvastatin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'metoprolol': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'warfarin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'clopidogrel': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'enalapril': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'valsartan': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'simvastatin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'metformin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'diabetes'},
    'glipizide': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'diabetes'},
    'insulin': {'type': 'Injectable', 'icon': 'needle', 'cat': 'diabetes'},
    'sitagliptin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'diabetes'},
    'pioglitazone': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'diabetes'},
    'ibuprofen': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'paracetamol': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'acetaminophen': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'aspirin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'naproxen': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'diclofenac': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'tramadol': {'type': 'Capsule', 'icon': 'capsule', 'cat': 'pain'},
    'valdecoxib': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'aceclofenac': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'omeprazole': {'type': 'Capsule', 'icon': 'capsule', 'cat': 'gi'},
    'pantoprazole': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'gi'},
    'ranitidine': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'gi'},
    'domperidone': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'gi'},
    'ondansetron': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'gi'},
    'cetirizine': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'allergy'},
    'loratadine': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'allergy'},
    'montelukast': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'respiratory'},
    'salbutamol': {'type': 'Inhaler', 'icon': 'spray', 'cat': 'respiratory'},
    'fluticasone': {'type': 'Inhaler', 'icon': 'spray', 'cat': 'respiratory'},
    'levothyroxine': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'thyroid'},
    'prednisone': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'steroid'},
    'prednisolone': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'steroid'},
    'dexamethasone': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'steroid'},
    'vitamin d3': {'type': 'Softgel', 'icon': 'capsule', 'cat': 'supplement'},
    'vitamin d': {'type': 'Softgel', 'icon': 'capsule', 'cat': 'supplement'},
    'vitamin c': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'vitamin b12': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'folic acid': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'calcium': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'iron': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'multivitamin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'supradyn': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'sertraline': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'mental_health'},
    'fluoxetine': {'type': 'Capsule', 'icon': 'capsule', 'cat': 'mental_health'},
    'escitalopram': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'mental_health'},
    'alprazolam': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'mental_health'},
    'diazepam': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'mental_health'},
    'volini': {'type': 'Gel', 'icon': 'pill', 'cat': 'pain'},
    'hifenac': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'pan': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'gi'},
    'combiflam': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'crocin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'dolo': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'pain'},
    'shelcal': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'supplement'},
    'ecosprin': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'thyronorm': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'thyroid'},
    'telma': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'cardiovascular'},
    'glycomet': {'type': 'Oral Tablet', 'icon': 'pill', 'cat': 'diabetes'},
}

TYPE_MAP = {
    'tab': 'Oral Tablet', 'tablet': 'Oral Tablet', 'tablets': 'Oral Tablet',
    'cap': 'Capsule', 'capsule': 'Capsule', 'capsules': 'Capsule',
    'syp': 'Syrup', 'syrup': 'Syrup',
    'inj': 'Injectable', 'injection': 'Injectable',
    'oint': 'Ointment', 'ointment': 'Ointment',
    'gel': 'Gel', 'drop': 'Eye/Ear Drops', 'drops': 'Eye/Ear Drops',
    'cream': 'Cream', 'susp': 'Suspension', 'suspension': 'Suspension',
    'sol': 'Solution', 'solution': 'Solution',
    'inh': 'Inhaler', 'inhaler': 'Inhaler', 'spray': 'Spray',
}

SKIP_WORDS = {
    'medicine', 'medication', 'prescribed', 'dosage', 'duration', 'details',
    'name', 'address', 'click', 'order', 'note', 'instruction', 'substitution',
    'allowed', 'applicable', 'wherever', 'morning', 'noon', 'evening', 'night',
    'contains', 'orally', 'local', 'application', 'take',
}


# ---- Image Preprocessing ----

def preprocess_image(image_data):
    if not TESSERACT_AVAILABLE:
        return None, None
    try:
        image = Image.open(io.BytesIO(image_data))
        img1 = image.convert('L')
        img1 = ImageEnhance.Contrast(img1).enhance(2.0)
        img1 = img1.filter(ImageFilter.SHARPEN)
        hist = img1.histogram()
        if sum(hist[:128]) > sum(hist[128:]):
            img1 = ImageOps.invert(img1)
        img1 = img1.point(lambda x: 255 if x > 140 else 0, '1')
        w, h = img1.size
        if w < 1200:
            s = 1200 / w
            img1 = img1.resize((int(w * s), int(h * s)), Image.LANCZOS)
        img2 = image.convert('L')
        img2 = ImageEnhance.Contrast(img2).enhance(1.5)
        img2 = ImageEnhance.Sharpness(img2).enhance(2.0)
        w2, h2 = img2.size
        if w2 < 1200:
            s = 1200 / w2
            img2 = img2.resize((int(w2 * s), int(h2 * s)), Image.LANCZOS)
        return img1, img2
    except Exception as e:
        print(f"Preprocessing error: {e}")
        return None, None


def extract_text_from_image(image_data):
    if not TESSERACT_AVAILABLE or not image_data:
        return ""
    try:
        results = []
        raw_image = Image.open(io.BytesIO(image_data))
        img_binary, img_soft = preprocess_image(image_data)
        configs = [
            ('--psm 6', img_binary), ('--psm 4', img_binary),
            ('--psm 3', img_binary), ('--psm 6', img_soft),
            ('--psm 4', img_soft), ('', raw_image),
        ]
        for config, img in configs:
            if img is None:
                continue
            try:
                t = pytesseract.image_to_string(img, config=config) if config else pytesseract.image_to_string(img)
                if t and len(t.strip()) > 20:
                    results.append(t)
            except Exception:
                pass
        if not results:
            return ""
        def score_text(t):
            s = len(t)
            s += len(re.findall(r'\d+\s*[).\]]\s*', t)) * 50
            for w in ['tab', 'cap', 'tablet', 'capsule', 'mg', 'daily', 'food', 'days', 'contains']:
                s += t.lower().count(w) * 30
            s += len(re.findall(r'\d\s*[-\.]\s*\d\s*[-\.]\s*\d', t)) * 40
            return s
        return max(results, key=score_text)
    except Exception as e:
        print(f"OCR Error: {e}")
        return ""


# ---- Field Extractors ----

def parse_dose_val(s):
    s = s.strip()
    if '/' in s:
        parts = s.split('/')
        try:
            return float(parts[0]) / float(parts[1])
        except (ValueError, ZeroDivisionError):
            return 0
    try:
        return float(s)
    except ValueError:
        return 0


def extract_dosing(text):
    m4 = re.search(r'([\d/]+)\s*[-.\x96\x97]+\s*([\d/]+)\s*[-.\x96\x97]+\s*([\d/]+)\s*[-.\x96\x97]+\s*([\d/]+)', text)
    if m4:
        vals = [parse_dose_val(m4.group(i)) for i in range(1, 5)]
        times = sum(1 for v in vals if v > 0)
        labels = {4: 'Four times daily', 3: 'Three times daily', 2: 'Twice daily', 1: 'Once daily'}
        return labels.get(times, 'Once daily'), sum(vals)
    m3 = re.search(r'([\d/]+)\s*[-.\x96\x97]+\s*([\d/]+)\s*[-.\x96\x97]+\s*([\d/]+)', text)
    if m3:
        vals = [parse_dose_val(m3.group(i)) for i in range(1, 4)]
        times = sum(1 for v in vals if v > 0)
        labels = {3: 'Three times daily', 2: 'Twice daily', 1: 'Once daily'}
        return labels.get(times, 'Once daily'), sum(vals)
    ms = re.search(r'-{2,}\s*(\d+)\s*-{2,}', text)
    if ms:
        return 'Once daily', parse_dose_val(ms.group(1))
    return None, 0


def extract_timing(text):
    text_norm = text.lower().replace(' ', '')
    for pat, val in [
        ('beforefood', 'Before food'), ('beforemeal', 'Before food'),
        ('beforebreakfast', 'Before food'), ('beforebreak', 'Before food'),
        ('afterfood', 'After food'), ('aftermeal', 'After food'),
        ('afterlunch', 'After food'), ('afterdinner', 'After food'),
        ('withfood', 'With food'), ('withmeal', 'With food'),
        ('emptystomach', 'Empty stomach'),
        ('localapplication', 'Local application'),
    ]:
        if pat in text_norm:
            return val
    for pat, val in [
        (r'before\s+food', 'Before food'), (r'after\s+food', 'After food'),
        (r'after\s+lunch', 'After food'), (r'with\s+food', 'With food'),
        (r'empty\s+stomach', 'Empty stomach'), (r'local\s+application', 'Local application'),
    ]:
        if re.search(pat, text, re.IGNORECASE):
            return val
    return None


def extract_frequency_text(text):
    text_norm = text.lower().replace(' ', '')
    for pat, val in [
        ('onceaday', 'Once daily'), ('oncedaily', 'Once daily'),
        ('twiceaday', 'Twice daily'), ('twicedaily', 'Twice daily'),
        ('threetimesaday', 'Three times daily'), ('fourtimesaday', 'Four times daily'),
    ]:
        if pat in text_norm:
            return val
    return None


def extract_duration(text):
    m = re.search(r'(\d+)\s*(days?|weeks?|months?)', text, re.IGNORECASE)
    if m:
        return f"{m.group(1)} {m.group(2).title()}"
    return None


def extract_quantity(text):
    m = re.search(r'(?:Tot|Total)\s*:?\s*(\d+)\s*(Tab|Cap|Tabs?|Caps?|ML)', text, re.IGNORECASE)
    if m:
        return f"{m.group(1)} {m.group(2).title()}"
    # Only match 2+ digit numbers for N'S pattern to avoid OCR noise like "1S"
    m = re.search(r'(\d{2,})\s*[\'S\u2019s]+\b', text)
    if m:
        return f"{m.group(1)} Tabs"
    return None


def extract_dosage_mg(text):
    m = re.search(r'(\d+\.?\d*)\s*(mg|mcg|g|ml|iu|gm|GM|MG)', text, re.IGNORECASE)
    if m:
        return f"{m.group(1)} {m.group(2).upper()}"
    return None


def extract_med_type(text):
    m = re.search(r'\b(TABLET|CAPSULE|SYRUP|DROP|GEL|CREAM|INJECTION|OINTMENT|INHALER|SPRAY|SUSPENSION)\b',
                  text, re.IGNORECASE)
    if m:
        return TYPE_MAP.get(m.group(1).lower(), m.group(1).title())
    return None


def lookup_known(name):
    name_lower = name.lower()
    for known, info in KNOWN_MEDICINES.items():
        if known in name_lower:
            return info
    return None


def is_noise_line(line):
    line_lower = line.strip().lower()
    if len(line_lower) < 2:
        return True
    if re.match(r'^m\s*[-\.]\s*n\s*[-\.]\s*e\s*[-\.]\s*n', line_lower):
        return True
    words = set(re.findall(r'[a-z]+', line_lower))
    if words and words.issubset(SKIP_WORDS):
        return True
    if line_lower.startswith('contains'):
        return True
    if re.match(r'^[\s\d\-\.@#%\(\)/|+]+$', line):
        return True
    return False


# ---- Name Cleaner ----

def clean_medicine_name(name_raw, type_prefix=None):
    """Clean a raw medicine name string into a presentable name."""
    name = name_raw.strip()

    # Remove dosing patterns from ANYWHERE: '1-0-0-0', '1---0---1', '-----1-----'
    name = re.sub(r'[\d/]+\s*[-]+\s*[\d/]+(?:\s*[-]+\s*[\d/]+)*', '', name).strip()
    name = re.sub(r'-{2,}\d+-{2,}', '', name).strip()

    # Remove duration: '15 days', '10 Days', '7days'
    name = re.sub(r'\s*\d+\s*(?:days?|weeks?|months?)', '', name, flags=re.IGNORECASE).strip()

    # Remove pack size: "15'S", "10'S", "15S"
    name = re.sub(r"\s+\d+\s*'?\s*[Ss](?:\s|$)", ' ', name).strip()

    # Remove frequency text: "Once a day", "Onceaday"
    name = re.sub(r'\s*(once|twice|three|four)\s*(a\s*day|daily|times?).*$', '', name, flags=re.IGNORECASE).strip()

    # Remove TABLET|..., DROP|... column remnants
    name = re.sub(r'\s*(TABLET|CAPSULE|DROP|GEL|CREAM|SYRUP|INJECTION)\s*\|.*$', '', name, flags=re.IGNORECASE).strip()

    # Detect type in name BEFORE removing type words
    type_in_name = extract_med_type(name)

    # Remove trailing TABLET/CAPSULE etc.
    name_no_type = re.sub(
        r'\s*(TABLET|CAPSULE|SYRUP|GEL|CREAM|DROP|INJECTION|OINTMENT|INHALER|SPRAY)\s*$',
        '', name, flags=re.IGNORECASE
    ).strip()

    # Remove trailing standalone 1-2 digit numbers but keep 3+ digit (like 500)
    name_no_type = re.sub(r'(?<![\d-])\s+\d{1,2}\s*$', '', name_no_type).strip()

    # Remove trailing punctuation
    name_no_type = name_no_type.rstrip(',.|@')

    # Determine final type
    if type_prefix:
        med_type = TYPE_MAP.get(type_prefix.lower(), 'Oral Tablet')
    elif type_in_name:
        med_type = type_in_name
    else:
        med_type = 'Oral Tablet'

    final_name = name_no_type.title() if name_no_type else name.title()
    return final_name, med_type


# ---- Main Parser ----

def parse_prescription_multi(text):
    medicines = parse_structured(text)
    if medicines:
        return finalize(medicines)
    medicines = parse_keyword_fallback(text)
    return finalize(medicines)


def detect_numbered_entry(line):
    """Detect if a line starts a new numbered medicine entry."""
    # Pattern A: "1) TAB. NAME" or "3) CAP. NAME"
    ma = re.match(
        r'(\d+)\s*[)\.\]]\s*(TAB|CAP|SYP|INJ|OINT|GEL|DROP|CREAM|SUSP|SOL|INH)[\.\s,]+(.+)',
        line, re.IGNORECASE
    )
    if ma:
        return {'name': ma.group(3).strip(), 'type_prefix': ma.group(2).lower()}

    # Pattern B: "1 PAN 40 TABLET..." — stop capture at dosing column (2+ spaces before digit-dash)
    mb = re.match(
        r'(\d+)\s*[)\.\]\s]\s*([A-Z][A-Za-z\s\d\',\.\-]*?)(?:\s{2,}\d\s*[-\.]\s*\d|\s{2,}-{2,}\d+-{2,}|\s*$)',
        line
    )
    if mb:
        name_part = mb.group(2).strip()
        first_word = name_part.split()[0].lower() if name_part.split() else ''
        if first_word in SKIP_WORDS or first_word in ('m', 'r', 'rx', 'id', 'dr'):
            return None
        if len(name_part) < 3:
            return None
        return {'name': name_part, 'type_prefix': None}

    # Pattern C: Full line capture for entries like "4. VOLINI PAIN RELIEF GEL, 75 GM"
    mc = re.match(
        r'(\d+)\s*[)\.\]\s]\s*([A-Z][A-Za-z\s\d\',\.\-]+)',
        line
    )
    if mc:
        name_part = mc.group(2).strip()
        first_word = name_part.split()[0].lower() if name_part.split() else ''
        if first_word in SKIP_WORDS or first_word in ('m', 'r', 'rx', 'id', 'dr'):
            return None
        if len(name_part) < 3:
            return None
        words = name_part.lower().split()
        noise_count = sum(1 for w in words if w in SKIP_WORDS)
        if noise_count > len(words) / 2:
            return None
        return {'name': name_part, 'type_prefix': None}

    return None


def parse_structured(text):
    lines = text.split('\n')
    medicines = []
    current_med = None
    current_block = []

    for line_raw in lines:
        line = line_raw.strip()
        if not line or is_noise_line(line):
            if current_med and line:
                current_block.append(line)
            continue

        new_entry = detect_numbered_entry(line)

        if new_entry:
            if current_med:
                process_block(current_med, current_block)
                if current_med.get('name') and len(current_med['name']) >= 2:
                    medicines.append(current_med)

            name_raw = new_entry['name']
            type_prefix = new_entry.get('type_prefix')

            dosage = extract_dosage_mg(name_raw)
            dur = extract_duration(name_raw)
            qty = extract_quantity(name_raw)
            freq_text = extract_frequency_text(line)
            freq_dosing, _ = extract_dosing(line)
            timing = extract_timing(line)

            cleaned_name, med_type = clean_medicine_name(name_raw, type_prefix)

            icon = 'pill'
            if 'cap' in (type_prefix or '').lower():
                icon = 'capsule'
            elif med_type == 'Inhaler':
                icon = 'spray'
            elif med_type == 'Injectable':
                icon = 'needle'

            known = lookup_known(name_raw)
            name_conf = 0.95 if known else 0.80

            current_med = {
                'name': cleaned_name,
                'dosage': dosage or '',
                'type': med_type,
                'icon': icon,
                'category': known.get('cat', 'unknown') if known else 'unknown',
                'frequency': freq_dosing or freq_text or '',
                'duration': dur or '',
                'timing': timing or '',
                'quantity': qty or '',
                'confidence': {'name': name_conf, 'dosage': 0.4, 'frequency': 0.4, 'overall': 0.6},
            }
            current_block = [line]
        else:
            if current_med is not None:
                current_block.append(line)

    if current_med:
        process_block(current_med, current_block)
        if current_med.get('name') and len(current_med['name']) >= 2:
            medicines.append(current_med)

    return medicines


def process_block(med, block_lines):
    """Extract fields from accumulated lines for a medicine entry."""
    block_text = ' '.join(block_lines)

    # Frequency from explicit text (Once a day, Twice a day) — highest priority
    freq_from_text = extract_frequency_text(block_text)

    # Dosing pattern (1-0-0-0, 1---0---1)
    if not med['frequency']:
        freq, total = extract_dosing(block_text)
        if freq:
            med['frequency'] = freq
            med['confidence']['frequency'] = 0.9

    # Explicit text overrides dosing pattern (e.g. "Twice a day" overrides "-----1-----")
    if freq_from_text:
        med['frequency'] = freq_from_text
        med['confidence']['frequency'] = 0.95

    # Fallback if still empty
    if not med['frequency']:
        med['frequency'] = 'Once daily'

    # Timing
    if not med['timing']:
        timing = extract_timing(block_text)
        if timing:
            med['timing'] = timing

    # Duration
    if not med['duration']:
        dur = extract_duration(block_text)
        if dur:
            med['duration'] = dur

    # Quantity
    if not med['quantity']:
        qty = extract_quantity(block_text)
        if qty:
            med['quantity'] = qty

    # Dosage from Contains: line
    if not med['dosage']:
        contains_match = re.search(
            r'[Cc]ontains?\s*:?\s*\w[\w\s]*?\((\d+\.?\d*)\s*(mg|mcg|g|ml|gm|GM|MG|%\s*W/W)\)',
            block_text, re.IGNORECASE
        )
        if contains_match:
            med['dosage'] = f"{contains_match.group(1)} {contains_match.group(2).upper()}"
            med['confidence']['dosage'] = 0.9
        else:
            dosage = extract_dosage_mg(block_text)
            if dosage:
                med['dosage'] = dosage
                med['confidence']['dosage'] = 0.7

    # Type from "TABLET | Once a day" or "DROP | Twice a day"
    # BUT only override if the medicine name doesn't already have a more specific type
    type_match = re.search(r'(TABLET|CAPSULE|DROP|GEL|CREAM|SYRUP|INJECTION)\s*[|]', block_text, re.IGNORECASE)
    if type_match:
        new_type = TYPE_MAP.get(type_match.group(1).lower(), type_match.group(1).title())
        # Only override if current type is generic 'Oral Tablet' or matches
        # Don't let "DROP" override a Gel that was detected from the name
        name_lower = med.get('name', '').lower()
        if med['type'] == 'Oral Tablet' and 'gel' not in name_lower:
            med['type'] = new_type

    # Default frequency
    if not med['frequency']:
        med['frequency'] = 'Once daily'


def parse_keyword_fallback(text):
    text_lower = text.lower()
    found = []
    seen = set()
    for med_name, med_info in KNOWN_MEDICINES.items():
        if med_name in text_lower and med_name not in seen:
            seen.add(med_name)
            found.append({'name': med_name.title(), **med_info})
    if not found:
        return []
    freq, _ = extract_dosing(text)
    if not freq:
        freq = extract_frequency_text(text) or 'Once daily'
    timing = extract_timing(text) or 'After food'
    duration = extract_duration(text) or '7 days'
    quantity = extract_quantity(text) or '30 Tabs'
    dosage = extract_dosage_mg(text)
    return [{
        'name': m['name'], 'dosage': dosage or '', 'type': m.get('type', 'Oral Tablet'),
        'icon': m.get('icon', 'pill'), 'category': m.get('cat', 'unknown'),
        'frequency': freq, 'duration': duration, 'timing': timing, 'quantity': quantity,
        'confidence': {'name': 0.9, 'dosage': 0.5, 'frequency': 0.7, 'overall': 0.7},
    } for m in found]


def finalize(medicines):
    for med in medicines:
        c = med.get('confidence', {})
        c['overall'] = round((c.get('name', 0.5) + c.get('dosage', 0.5) + c.get('frequency', 0.5)) / 3, 2)
        if not med.get('frequency'):
            med['frequency'] = 'Once daily'
        if not med.get('timing'):
            med['timing'] = 'After food'
        if not med.get('duration'):
            med['duration'] = '7 days'
        if not med.get('quantity'):
            med['quantity'] = '30 Tabs'
    return medicines


def scan_prescription(image_data):
    """Full pipeline: Multi-pass OCR -> Multi-format parse -> Structured output."""
    text = extract_text_from_image(image_data) if image_data else ""
    if text:
        print(f"[OCR] Extracted text ({len(text)} chars):\n{text[:800]}")
        results = parse_prescription_multi(text)
        if results:
            return {
                'success': True,
                'extracted_text': text,
                'medicines': results,
                'count': len(results),
            }
    return {
        'success': True,
        'extracted_text': text or '',
        'medicines': [],
        'count': 0,
        'message': 'No medicines could be extracted. Please add medicines manually.'
            if not text else 'No recognized medicines found in the text.',
    }
