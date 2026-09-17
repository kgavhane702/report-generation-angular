"""Standalone, platform-independent Open XML PowerPoint slide merger.

This file contains the complete production merger in one module. It requires
Python 3.10 or newer and only uses the Python standard library. Source packages
are validated before merging so malformed presentations do not produce outputs
that PowerPoint must repair.
"""


# ============================================================================
# constants.py
# ============================================================================

STANDARD_NAMESPACES = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart', 'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006', 'p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main', 'p15': 'http://schemas.microsoft.com/office/powerpoint/2012/main', 'p16': 'http://schemas.microsoft.com/office/powerpoint/2015/main', 'a14': 'http://schemas.microsoft.com/office/drawing/2010/main', 'a16': 'http://schemas.microsoft.com/office/drawing/2014/main', 'c14': 'http://schemas.microsoft.com/office/drawing/2007/8/2/chart', 'c16': 'http://schemas.microsoft.com/office/drawing/2014/chart', 'c16r2': 'http://schemas.microsoft.com/office/drawing/2015/06/chart', 'v': 'urn:schemas-microsoft-com:vml'}
CONTENT_TYPE_DEFAULTS = {'xml': 'application/xml', 'rels': 'application/vnd.openxmlformats-package.relationships+xml', 'jpeg': 'image/jpeg', 'jpg': 'image/jpeg', 'png': 'image/png', 'emf': 'image/x-emf', 'wmf': 'image/x-wmf', 'gif': 'image/gif', 'tif': 'image/tiff', 'tiff': 'image/tiff', 'bin': 'application/vnd.openxmlformats-officedocument.oleObject', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12', 'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12', 'vml': 'application/vnd.openxmlformats-officedocument.vmlDrawing'}
NS_PRESENTATION = 'http://schemas.openxmlformats.org/presentationml/2006/main'
NS_DRAWING = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS_DOCUMENT_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS_CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types'
NS_SECTIONS = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
NS_EXTENDED_PROPERTIES = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'
NS_PROPERTY_TYPES = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes'
CT_LAYOUT = 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml'
CT_MASTER = 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml'
CT_SLIDE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'
CT_THEME_OVERRIDE = 'application/vnd.openxmlformats-officedocument.themeOverride+xml'
CT_CHART_DRAWING = 'application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml'
CT_CHART_STYLE = 'application/vnd.ms-office.chartstyle+xml'
CT_CHART_COLOR_STYLE = 'application/vnd.ms-office.chartcolorstyle+xml'
CT_TAGS = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml'
CT_NOTES = 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml'
FIRST_SLIDE_ID = 256
BASE_LAYOUT_WEIGHT = 10
DEFAULT_OUTPUT_NAME = 'merged_output_autonomous.pptx'
DEFAULT_INPUT_DIRECTORY = 'ppts'
REL_SLIDE = NS_DOCUMENT_RELATIONSHIPS + '/slide'
REL_SLIDE_MASTER = NS_DOCUMENT_RELATIONSHIPS + '/slideMaster'
SHARED_PART_PREFIXES = ('ppt/slideLayouts/', 'ppt/slideMasters/', 'ppt/theme/', 'ppt/notesMasters/', 'ppt/handoutMasters/', 'ppt/media/', 'customXml/')
INSTANCE_FOLDERS = ('slides', 'notesSlides', 'drawings', 'charts')


# ============================================================================
# xml_names.py
# ============================================================================

def qname(namespace: str, local_name: str) -> str:
    return '{' + namespace + '}' + local_name


# ============================================================================
# selection.py
# ============================================================================

import re

def natural_sort_key(s):
    """Natural sorting key for human-ordered filenames (e.g. slide_01, slide_2, slide_10)."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split('(\\d+)', str(s))]

def parse_slide_selection(selection, total_slides):
    """
    Parses various slide selection formats into a list of 0-based slide indices.

    Supported formats:
    - None / 'all' / '*': All slides [0, 1, ..., total_slides - 1]
    - Single integer (1-based): 1 -> [0], -1 -> [total_slides - 1]
    - Python slice: slice(0, 3) -> [0, 1, 2]
    - Range / selective string: "1-3, 5, 8-10", "5-", "-3", "5, 2, 1"
    - Python list/tuple: [1, "3-5", 8]
    """
    if selection is None or selection == 'all' or selection == '*':
        return list(range(total_slides))
    if isinstance(selection, slice):
        return list(range(total_slides))[selection]
    if isinstance(selection, int):
        idx = selection - 1 if selection > 0 else total_slides + selection
        if 0 <= idx < total_slides:
            return [idx]
        raise IndexError(f'Slide index {selection} out of range for presentation with {total_slides} slides.')
    if isinstance(selection, (list, tuple)):
        indices = []
        for item in selection:
            indices.extend(parse_slide_selection(item, total_slides))
        return indices
    if isinstance(selection, str):
        indices = []
        tokens = [t.strip() for t in selection.split(',') if t.strip()]
        for token in tokens:
            if '-' in token:
                parts = token.split('-', 1)
                start_str, end_str = (parts[0].strip(), parts[1].strip())
                if start_str and (not end_str):
                    start = int(start_str) - 1
                    end = total_slides
                elif not start_str and end_str:
                    start = 0
                    end = int(end_str)
                else:
                    start = int(start_str) - 1
                    end = int(end_str)
                start = max(0, min(start, total_slides))
                end = max(0, min(end, total_slides))
                indices.extend(list(range(start, end)))
            else:
                s_num = int(token)
                idx = s_num - 1 if s_num > 0 else total_slides + s_num
                if 0 <= idx < total_slides:
                    indices.append(idx)
                else:
                    raise IndexError(f'Slide number {token} out of range for presentation with {total_slides} slides.')
        return indices
    raise TypeError(f'Unsupported slide selection type: {type(selection)}')


# ============================================================================
# hashing.py
# ============================================================================

from pathlib import Path
import hashlib

def file_sha256(file_path):
    """Computes SHA-256 hash of a file's binary content."""
    try:
        return hashlib.sha256(Path(file_path).read_bytes()).hexdigest()
    except Exception:
        return ''


# ============================================================================
# content_types.py
# ============================================================================

import xml.etree.ElementTree as ET

class ContentTypes:
    """Own declarations in one package content-type document."""

    def __init__(self, tree):
        self.tree = tree
        self.root = tree.getroot()

    def ensure_content_type_default(self, ext, content_type):
        ext = ext.lower().lstrip('.')
        for d in self.root.findall(qname(NS_CONTENT_TYPES, 'Default')):
            if d.get('Extension', '').lower() == ext:
                return
        d_elem = ET.SubElement(self.root, qname(NS_CONTENT_TYPES, 'Default'))
        d_elem.set('Extension', ext)
        d_elem.set('ContentType', content_type)

    def ensure_content_type_override(self, part_name, content_type):
        if not part_name.startswith('/'):
            part_name = '/' + part_name
        for o in self.root.findall(qname(NS_CONTENT_TYPES, 'Override')):
            if o.get('PartName') == part_name:
                o.set('ContentType', content_type)
                return
        o_elem = ET.SubElement(self.root, qname(NS_CONTENT_TYPES, 'Override'))
        o_elem.set('PartName', part_name)
        o_elem.set('ContentType', content_type)


# ============================================================================
# xmlio.py
# ============================================================================

from pathlib import Path
import xml.etree.ElementTree as ET
for prefix, uri in STANDARD_NAMESPACES.items():
    ET.register_namespace(prefix, uri)

def get_presentation_slide_paths(extracted_pptx_dir):
    """
    Discovers slide XML paths in exact visual presentation order as defined in presentation.xml.
    Falls back to natural-sorted filenames in ppt/slides if presentation.xml is missing.
    """
    ppt_dir = Path(extracted_pptx_dir) / 'ppt'
    pres_xml = ppt_dir / 'presentation.xml'
    pres_rels = ppt_dir / '_rels' / 'presentation.xml.rels'
    if pres_xml.exists() and pres_rels.exists():
        try:
            rels_tree = ET.parse(pres_rels)
            rid_to_target = {}
            for rel in rels_tree.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
                r_type = rel.get('Type', '')
                if r_type.endswith('/slide'):
                    rid_to_target[rel.get('Id')] = rel.get('Target')
            pres_tree = ET.parse(pres_xml)
            sldIdLst = pres_tree.getroot().find(qname(NS_PRESENTATION, 'sldIdLst'))
            if sldIdLst is not None:
                slides = []
                for sldId in sldIdLst.findall(qname(NS_PRESENTATION, 'sldId')):
                    r_id = sldId.get(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'))
                    if r_id and r_id in rid_to_target:
                        target = rid_to_target[r_id]
                        slide_path = (ppt_dir / target).resolve()
                        if slide_path.exists():
                            slides.append(slide_path)
                if slides:
                    return slides
        except Exception as e:
            print(f'[WARNING] Error reading canonical presentation order: {e}')
    slides_dir = ppt_dir / 'slides'
    if slides_dir.exists():
        return sorted([p for p in slides_dir.glob('slide*.xml') if '_rels' not in p.parts], key=lambda p: natural_sort_key(p.name))
    return []

def is_slide_hidden(slide_xml_path):
    """Checks if a slide is marked as hidden in OpenXML (<p:sld show="0">)."""
    try:
        tree = ET.parse(slide_xml_path)
        root = tree.getroot()
        show_val = root.get('show', '1').lower()
        return show_val in ('0', 'false')
    except Exception:
        return False

def save_presentation_xml(tree, file_path):
    """Saves presentation.xml with standard OpenXML namespaces."""
    for prefix, uri in STANDARD_NAMESPACES.items():
        ET.register_namespace(prefix, uri)
    tree.write(file_path, xml_declaration=True, encoding='utf-8')

def save_rels_xml(tree, file_path):
    """Saves any .rels file with standard default relationships namespace."""
    ET.register_namespace('', NS_PACKAGE_RELATIONSHIPS)
    tree.write(file_path, xml_declaration=True, encoding='utf-8')

def save_content_types_xml(tree, file_path):
    """Saves [Content_Types].xml with standard default content-types namespace."""
    ET.register_namespace('', NS_CONTENT_TYPES)
    tree.write(file_path, xml_declaration=True, encoding='utf-8')

def update_doc_props_app(app_xml_path, total_slides, total_notes):
    """Updates docProps/app.xml with accurate slide and notes count to prevent repair warnings."""
    if not app_xml_path.exists():
        return
    try:
        tree = ET.parse(app_xml_path)
        root = tree.getroot()
        ns = {'ep': NS_EXTENDED_PROPERTIES, 'vt': NS_PROPERTY_TYPES}
        slides_elem = root.find('ep:Slides', ns)
        if slides_elem is not None:
            slides_elem.text = str(total_slides)
        notes_elem = root.find('ep:Notes', ns)
        if notes_elem is not None:
            notes_elem.text = str(total_notes)
        ET.register_namespace('', NS_EXTENDED_PROPERTIES)
        ET.register_namespace('vt', NS_PROPERTY_TYPES)
        tree.write(app_xml_path, xml_declaration=True, encoding='utf-8')
    except Exception as e:
        print(f'[WARNING] Could not update app.xml: {e}')

def sync_presentation_sections(pres_root, slide_ids):
    """Synchronizes presentation.xml extLst section slide IDs with the merged slide IDs."""
    ns_p14 = NS_SECTIONS
    section_lst = pres_root.find(f'.//{{{ns_p14}}}sectionLst')
    if section_lst is not None:
        sections = section_lst.findall(f'{{{ns_p14}}}section')
        if sections:
            first_sec = sections[0]
            sldIdLst = first_sec.find(f'{{{ns_p14}}}sldIdLst')
            if sldIdLst is None:
                sldIdLst = ET.SubElement(first_sec, f'{{{ns_p14}}}sldIdLst')
            else:
                sldIdLst.clear()
            for s_id in slide_ids:
                s_elem = ET.SubElement(sldIdLst, f'{{{ns_p14}}}sldId')
                s_elem.set('id', str(s_id))
            for sec in sections[1:]:
                s_lst = sec.find(f'{{{ns_p14}}}sldIdLst')
                if s_lst is not None:
                    s_lst.clear()


# ============================================================================
# recipes.py
# ============================================================================

from pathlib import Path
import json

def normalize_input_spec(item):
    """
    Normalizes different input formats (Path, str, tuple, dict) into a standard dictionary:
    {"file": Path, "slides": selection_expr, "skip_hidden": bool}
    """
    if isinstance(item, (str, Path)):
        str_val = str(item)
        if ':' in str_val and (not (len(str_val) >= 2 and str_val[1] == ':' and (str_val.count(':') == 1))):
            last_colon = str_val.rfind(':')
            if last_colon > 1:
                potential_file = Path(str_val[:last_colon])
                if potential_file.exists():
                    return {'file': potential_file, 'slides': str_val[last_colon + 1:], 'skip_hidden': False}
        return {'file': Path(item), 'slides': None, 'skip_hidden': False}
    if isinstance(item, (tuple, list)):
        f = Path(item[0])
        slides = item[1] if len(item) > 1 else None
        skip_hidden = item[2] if len(item) > 2 else False
        return {'file': f, 'slides': slides, 'skip_hidden': skip_hidden}
    if isinstance(item, dict):
        f = Path(item.get('file') or item.get('path'))
        slides = item.get('slides') or item.get('range')
        skip_hidden = bool(item.get('skip_hidden', False))
        return {'file': f, 'slides': slides, 'skip_hidden': skip_hidden}
    raise TypeError(f'Invalid input presentation specification: {item}')

def load_recipe_file(json_path):
    """
    Loads an external JSON recipe/manifest file and returns a list of normalized slide specs.
    Automatically resolves relative file paths relative to the JSON file's directory.

    :param json_path: Path to the JSON recipe file.
    :return: List of normalized specification dictionaries.
    """
    json_path = Path(json_path).resolve()
    if not json_path.exists():
        raise FileNotFoundError(f'JSON recipe file not found: {json_path}')
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f'JSON recipe must contain a top-level list of slide specifications, got {type(data).__name__}')
    resolved_specs = []
    base_dir = json_path.parent
    for item in data:
        spec = normalize_input_spec(item)
        f_path = spec['file']
        if not f_path.is_absolute():
            resolved_f = (base_dir / f_path).resolve()
            if resolved_f.exists():
                spec['file'] = resolved_f
            else:
                spec['file'] = f_path.resolve()
        else:
            spec['file'] = f_path.resolve()
        resolved_specs.append(spec)
    return resolved_specs

def normalize_inputs(input_pptx_files):
    if not input_pptx_files:
        raise ValueError('No input PPTX files provided.')
    if isinstance(input_pptx_files, (str, Path)) and str(input_pptx_files).lower().endswith('.json'):
        normalized_specs = load_recipe_file(input_pptx_files)
    elif isinstance(input_pptx_files, (list, tuple)) and len(input_pptx_files) == 1 and isinstance(input_pptx_files[0], (str, Path)) and str(input_pptx_files[0]).lower().endswith('.json'):
        normalized_specs = load_recipe_file(input_pptx_files[0])
    else:
        if isinstance(input_pptx_files, (str, Path)):
            input_pptx_files = [input_pptx_files]
        normalized_specs = []
        for item in input_pptx_files:
            if isinstance(item, (str, Path)) and str(item).lower().endswith('.json'):
                normalized_specs.extend(load_recipe_file(item))
            else:
                normalized_specs.append(normalize_input_spec(item))
    return normalized_specs

def unique_sources(normalized_specs):
    unique_source_files = []
    seen_files = set()
    for spec in normalized_specs:
        src_path = spec['file'].resolve()
        if not src_path.exists():
            raise FileNotFoundError(f'Input presentation not found: {src_path}')
        if src_path not in seen_files:
            seen_files.add(src_path)
            unique_source_files.append(src_path)
    return unique_source_files


# ============================================================================
# validation.py
# ============================================================================

from collections import Counter
from pathlib import Path, PurePosixPath
import posixpath
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile, is_zipfile
REQUIRED_PARTS = {'[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels'}
RELATIONSHIP_TYPES = {'slide': NS_DOCUMENT_RELATIONSHIPS + '/slide', 'slideMaster': NS_DOCUMENT_RELATIONSHIPS + '/slideMaster', 'slideLayout': NS_DOCUMENT_RELATIONSHIPS + '/slideLayout', 'diagramData': NS_DOCUMENT_RELATIONSHIPS + '/diagramData', 'diagramLayout': NS_DOCUMENT_RELATIONSHIPS + '/diagramLayout', 'diagramQuickStyle': NS_DOCUMENT_RELATIONSHIPS + '/diagramQuickStyle', 'diagramColors': NS_DOCUMENT_RELATIONSHIPS + '/diagramColors'}
SLIDE_ID_MIN = FIRST_SLIDE_ID
SLIDE_ID_MAX = 2147483647
MASTER_ID_MIN = 2147483648
LAYOUT_ID_MIN = 2147483649
MASTER_LAYOUT_ID_MAX = 4294967295
DIAGRAM_NS = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'

class PptxValidationError(ValueError):
    """Raised when an input package would be unsafe to merge."""

    def __init__(self, source, issues):
        self.source = Path(source)
        self.issues = tuple(issues)
        detail = '\n'.join((f'  - {issue}' for issue in self.issues))
        super().__init__(f'Invalid source PPTX: {self.source}\nThe merger stopped before creating output because the source package has {len(self.issues)} validation issue(s):\n{detail}')

def _relationship_part_name(owner):
    if not owner:
        return '_rels/.rels'
    part = PurePosixPath(owner)
    return str(part.parent / '_rels' / f'{part.name}.rels')

def _owner_part_name(relationship_part):
    if relationship_part == '_rels/.rels':
        return ''
    part = PurePosixPath(relationship_part)
    if part.parent.name != '_rels' or not part.name.endswith('.rels'):
        return None
    owner_name = part.name[:-len('.rels')]
    owner_parent = part.parent.parent
    return str(owner_parent / owner_name) if str(owner_parent) != '.' else owner_name

def _resolve_target(owner, target):
    target = target.split('#', 1)[0]
    if target.startswith('/'):
        return posixpath.normpath(target.lstrip('/'))
    return posixpath.normpath(posixpath.join(posixpath.dirname(owner), target))

def _parse_xml(archive, part, issues, parsed):
    if part in parsed:
        return parsed[part]
    try:
        root = ET.fromstring(archive.read(part))
    except (KeyError, ET.ParseError) as exc:
        issues.append(f'{part}: XML cannot be parsed ({exc})')
        root = None
    parsed[part] = root
    return root

def _read_relationships(archive, names, owner, issues, parsed):
    relationship_part = _relationship_part_name(owner)
    if relationship_part not in names:
        return {}
    root = _parse_xml(archive, relationship_part, issues, parsed)
    if root is None:
        return {}
    relationships = {}
    for relationship in root.findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
        relationship_id = relationship.get('Id')
        relationship_type = relationship.get('Type')
        target = relationship.get('Target')
        if not relationship_id or not relationship_type or target is None:
            issues.append(f'{relationship_part}: every Relationship requires Id, Type, and Target')
            continue
        if relationship_id in relationships:
            issues.append(f'{relationship_part}: duplicate relationship Id {relationship_id!r}')
            continue
        external = relationship.get('TargetMode') == 'External'
        resolved = None if external else _resolve_target(owner, target)
        if not external and resolved not in names:
            issues.append(f'{relationship_part}: {relationship_id} targets missing part {resolved!r}')
        relationships[relationship_id] = {'type': relationship_type, 'target': target, 'resolved': resolved, 'external': external}
    return relationships

def _integer_id(value, label, minimum, maximum, issues):
    try:
        number = int(value)
    except (TypeError, ValueError):
        issues.append(f'{label}: expected an integer ID, found {value!r}')
        return None
    if not minimum <= number <= maximum:
        issues.append(f'{label}: ID {number} is outside the allowed range {minimum}..{maximum}')
    return number

def _validate_content_types(archive, names, issues, parsed):
    root = _parse_xml(archive, '[Content_Types].xml', issues, parsed)
    if root is None:
        return
    defaults = {}
    overrides = {}
    for child in root:
        local_name = child.tag.rsplit('}', 1)[-1]
        if local_name == 'Default':
            key = (child.get('Extension') or '').lower()
            content_type = child.get('ContentType')
            collection = defaults
        elif local_name == 'Override':
            key = (child.get('PartName') or '').lstrip('/')
            content_type = child.get('ContentType')
            collection = overrides
        else:
            continue
        if not key or not content_type:
            issues.append('[Content_Types].xml: entries require a key and ContentType')
            continue
        if key in collection and collection[key] != content_type:
            issues.append(f'[Content_Types].xml: conflicting content types for {key!r}')
        collection[key] = content_type
    for part in sorted(names - {'[Content_Types].xml'}):
        filename = PurePosixPath(part).name
        extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        if part not in overrides and extension not in defaults:
            issues.append(f'[Content_Types].xml: no content type covers {part!r}')

def _validate_xml_relationship_references(archive, names, relationships_by_owner, issues, parsed):
    for part in sorted(names):
        if not part.endswith(('.xml', '.vml')) or part == '[Content_Types].xml':
            continue
        root = _parse_xml(archive, part, issues, parsed)
        if root is None:
            continue
        referenced_ids = set()
        for element in root.iter():
            for attribute, value in element.attrib.items():
                if attribute.startswith('{' + NS_DOCUMENT_RELATIONSHIPS + '}') and value:
                    referenced_ids.add(value)
        if not referenced_ids:
            continue
        relationships = relationships_by_owner.get(part, {})
        for relationship_id in sorted(referenced_ids - relationships.keys()):
            issues.append(f'{part}: references missing relationship Id {relationship_id!r}')

def _validate_diagrams(archive, names, relationships_by_owner, issues, parsed):
    expected_types = {'dm': RELATIONSHIP_TYPES['diagramData'], 'lo': RELATIONSHIP_TYPES['diagramLayout'], 'qs': RELATIONSHIP_TYPES['diagramQuickStyle'], 'cs': RELATIONSHIP_TYPES['diagramColors']}
    for part in sorted((name for name in names if name.endswith('.xml'))):
        root = _parse_xml(archive, part, issues, parsed)
        if root is None:
            continue
        relationships = relationships_by_owner.get(part, {})
        for rel_ids in root.iter(qname(DIAGRAM_NS, 'relIds')):
            for attribute_name, expected_type in expected_types.items():
                relationship_id = rel_ids.get(qname(NS_DOCUMENT_RELATIONSHIPS, attribute_name))
                if not relationship_id:
                    issues.append(f'{part}: SmartArt relIds is missing r:{attribute_name}')
                    continue
                relationship = relationships.get(relationship_id)
                if relationship and relationship['type'] != expected_type:
                    issues.append(f"{part}: SmartArt r:{attribute_name}={relationship_id!r} has relationship type {relationship['type']!r}, expected {expected_type!r}")

def _validate_presentation_graph(archive, names, relationships_by_owner, issues, parsed):
    presentation_part = 'ppt/presentation.xml'
    presentation = _parse_xml(archive, presentation_part, issues, parsed)
    if presentation is None:
        return
    presentation_relationships = relationships_by_owner.get(presentation_part, {})
    slide_ids = []
    slide_parts = []
    for element in presentation.findall(qname(NS_PRESENTATION, 'sldIdLst') + '/' + qname(NS_PRESENTATION, 'sldId')):
        slide_id = _integer_id(element.get('id'), 'ppt/presentation.xml slide', SLIDE_ID_MIN, SLIDE_ID_MAX, issues)
        if slide_id is not None:
            slide_ids.append(slide_id)
        relationship_id = element.get(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'))
        relationship = presentation_relationships.get(relationship_id)
        if relationship is None:
            continue
        if relationship['type'] != RELATIONSHIP_TYPES['slide']:
            issues.append(f'ppt/presentation.xml: {relationship_id!r} is not a slide relationship')
        elif relationship['resolved']:
            slide_parts.append(relationship['resolved'])
    duplicate_slide_ids = sorted((value for value, count in Counter(slide_ids).items() if count > 1))
    if duplicate_slide_ids:
        issues.append(f'ppt/presentation.xml: duplicate slide IDs {duplicate_slide_ids}')
    if len(slide_parts) != len(set(slide_parts)):
        issues.append('ppt/presentation.xml: the same slide part is listed more than once')
    master_ids = []
    master_parts = []
    for element in presentation.findall(qname(NS_PRESENTATION, 'sldMasterIdLst') + '/' + qname(NS_PRESENTATION, 'sldMasterId')):
        master_id = _integer_id(element.get('id'), 'ppt/presentation.xml slide master', MASTER_ID_MIN, MASTER_LAYOUT_ID_MAX, issues)
        if master_id is not None:
            master_ids.append(master_id)
        relationship_id = element.get(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'))
        relationship = presentation_relationships.get(relationship_id)
        if relationship is None:
            continue
        if relationship['type'] != RELATIONSHIP_TYPES['slideMaster']:
            issues.append(f'ppt/presentation.xml: {relationship_id!r} is not a slide-master relationship')
        elif relationship['resolved']:
            master_parts.append(relationship['resolved'])
    duplicate_master_ids = sorted((value for value, count in Counter(master_ids).items() if count > 1))
    if duplicate_master_ids:
        issues.append(f'ppt/presentation.xml: duplicate slide-master IDs {duplicate_master_ids}')
    layout_ids = []
    layout_owners = {}
    for master_part in master_parts:
        master = _parse_xml(archive, master_part, issues, parsed)
        if master is None:
            continue
        master_relationships = relationships_by_owner.get(master_part, {})
        listed_layout_parts = []
        for element in master.findall(qname(NS_PRESENTATION, 'sldLayoutIdLst') + '/' + qname(NS_PRESENTATION, 'sldLayoutId')):
            layout_id = _integer_id(element.get('id'), f'{master_part} slide layout', LAYOUT_ID_MIN, MASTER_LAYOUT_ID_MAX, issues)
            if layout_id is not None:
                layout_ids.append(layout_id)
            relationship_id = element.get(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'))
            relationship = master_relationships.get(relationship_id)
            if relationship is None:
                continue
            if relationship['type'] != RELATIONSHIP_TYPES['slideLayout']:
                issues.append(f'{master_part}: {relationship_id!r} is not a slide-layout relationship')
                continue
            layout_part = relationship['resolved']
            if layout_part:
                listed_layout_parts.append(layout_part)
                previous_owner = layout_owners.setdefault(layout_part, master_part)
                if previous_owner != master_part:
                    issues.append(f'{layout_part}: listed by multiple masters ({previous_owner!r} and {master_part!r})')
        related_layout_parts = {relationship['resolved'] for relationship in master_relationships.values() if relationship['type'] == RELATIONSHIP_TYPES['slideLayout'] and relationship['resolved']}
        if set(listed_layout_parts) != related_layout_parts:
            issues.append(f'{master_part}: slide-layout ID list does not match its layout relationships')
    duplicate_layout_ids = sorted((value for value, count in Counter(layout_ids).items() if count > 1))
    if duplicate_layout_ids:
        issues.append(f'slide layouts must have presentation-wide unique IDs; duplicates: {duplicate_layout_ids}')
    master_layout_collisions = sorted(set(master_ids) & set(layout_ids))
    if master_layout_collisions:
        issues.append('slide-master and slide-layout IDs share the same presentation-wide ID value(s): ' + ', '.join((str(value) for value in master_layout_collisions)))
    for layout_part, master_part in sorted(layout_owners.items()):
        back_links = [relationship['resolved'] for relationship in relationships_by_owner.get(layout_part, {}).values() if relationship['type'] == RELATIONSHIP_TYPES['slideMaster']]
        if back_links != [master_part]:
            issues.append(f'{layout_part}: expected one slide-master backlink to {master_part!r}, found {back_links!r}')
    for slide_part in slide_parts:
        layout_links = [relationship['resolved'] for relationship in relationships_by_owner.get(slide_part, {}).values() if relationship['type'] == RELATIONSHIP_TYPES['slideLayout']]
        if len(layout_links) != 1:
            issues.append(f'{slide_part}: expected exactly one slide-layout relationship, found {len(layout_links)}')
        elif layout_links[0] not in layout_owners:
            issues.append(f'{slide_part}: layout {layout_links[0]!r} is not registered by a slide master')
    section_members = []
    for element in presentation.findall('.//' + qname(NS_SECTIONS, 'section') + '/.//' + qname(NS_SECTIONS, 'sldId')):
        section_id = _integer_id(element.get('id'), 'ppt/presentation.xml section slide', SLIDE_ID_MIN, SLIDE_ID_MAX, issues)
        if section_id is not None:
            section_members.append(section_id)
    unknown_section_ids = sorted(set(section_members) - set(slide_ids))
    if unknown_section_ids:
        issues.append(f'ppt/presentation.xml: sections reference unknown slide IDs {unknown_section_ids}')
    duplicate_section_members = sorted((value for value, count in Counter(section_members).items() if count > 1))
    if duplicate_section_members:
        issues.append(f'ppt/presentation.xml: slides occur in multiple sections: {duplicate_section_members}')

def validate_pptx_source(source):
    """Validate an input PPTX and return its resolved path, or raise a detailed error."""
    source = Path(source).resolve()
    if not source.exists():
        raise FileNotFoundError(f'Input presentation not found: {source}')
    if not is_zipfile(source):
        raise BadZipFile(f'Input presentation is not a valid ZIP/PPTX package: {source}')
    issues = []
    parsed = {}
    try:
        with ZipFile(source) as archive:
            members = [info.filename for info in archive.infolist() if not info.is_dir()]
            duplicate_members = sorted((name for name, count in Counter(members).items() if count > 1))
            if duplicate_members:
                issues.append(f'duplicate ZIP members: {duplicate_members}')
            names = set(members)
            missing_required = sorted(REQUIRED_PARTS - names)
            if missing_required:
                issues.append(f'missing required package parts: {missing_required}')
            bad_member = archive.testzip()
            if bad_member:
                issues.append(f'ZIP CRC failure in {bad_member!r}')
            for relationship_part in sorted((name for name in names if name.endswith('.rels'))):
                owner = _owner_part_name(relationship_part)
                if owner is None:
                    issues.append(f'{relationship_part}: invalid relationship-part location')
                elif owner and owner not in names:
                    issues.append(f'{relationship_part}: owner part {owner!r} does not exist')
            relationships_by_owner = {}
            owners = {''}
            owners.update((owner for relationship_part in names if relationship_part.endswith('.rels') for owner in [_owner_part_name(relationship_part)] if owner is not None))
            for owner in sorted(owners):
                relationships_by_owner[owner] = _read_relationships(archive, names, owner, issues, parsed)
            if '[Content_Types].xml' in names:
                _validate_content_types(archive, names, issues, parsed)
            for part in sorted((name for name in names if name.endswith(('.xml', '.rels', '.vml')))):
                _parse_xml(archive, part, issues, parsed)
            if REQUIRED_PARTS <= names:
                _validate_xml_relationship_references(archive, names, relationships_by_owner, issues, parsed)
                _validate_diagrams(archive, names, relationships_by_owner, issues, parsed)
                _validate_presentation_graph(archive, names, relationships_by_owner, issues, parsed)
    except BadZipFile:
        raise
    unique_issues = list(dict.fromkeys(issues))
    if unique_issues:
        raise PptxValidationError(source, unique_issues)
    return source


# ============================================================================
# workspace.py
# ============================================================================

import shutil
import xml.etree.ElementTree as ET
import zipfile

class MergeWorkspace:
    """Package-level state for a single merge, owned by the engine temporary directory."""

    def __init__(self, root, unique_source_files):
        self.root = root
        self.root.mkdir()
        self.harvested_content_types = []
        self._extract_base(unique_source_files)
        self._create_directories()
        self._harvest_shared_parts(unique_source_files)
        self._clear_instance_folders()
        self._load_documents()
        self._clear_slide_registrations()
        self._prepare_content_types()
        self._initialize_slide_ids()

    def _extract_base(self, unique_source_files):
        best_base = unique_source_files[0]
        max_entries = 0
        for f in unique_source_files:
            with zipfile.ZipFile(f, 'r') as z:
                nl = z.namelist()
                score = len(nl) + BASE_LAYOUT_WEIGHT * len([x for x in nl if 'slideLayout' in x])
                if score > max_entries:
                    max_entries = score
                    best_base = f
        with zipfile.ZipFile(best_base, 'r') as zf:
            zf.extractall(self.root)

    def _create_directories(self):
        self.ppt_dir = self.root / 'ppt'
        self.slides_dir = self.ppt_dir / 'slides'
        self.slides_rels_dir = self.slides_dir / '_rels'
        self.layouts_dir = self.ppt_dir / 'slideLayouts'
        self.layouts_rels_dir = self.layouts_dir / '_rels'
        self.masters_dir = self.ppt_dir / 'slideMasters'
        self.masters_rels_dir = self.masters_dir / '_rels'
        self.charts_dir = self.ppt_dir / 'charts'
        self.charts_rels_dir = self.charts_dir / '_rels'
        self.drawings_dir = self.ppt_dir / 'drawings'
        self.media_dir = self.ppt_dir / 'media'
        self.embeddings_dir = self.ppt_dir / 'embeddings'
        self.tags_dir = self.ppt_dir / 'tags'
        self.notes_dir = self.ppt_dir / 'notesSlides'
        self.notes_rels_dir = self.notes_dir / '_rels'
        self.theme_dir = self.ppt_dir / 'theme'
        self.diagrams_dir = self.ppt_dir / 'diagrams'
        for d in [self.slides_dir, self.slides_rels_dir, self.layouts_dir, self.layouts_rels_dir, self.masters_dir, self.masters_rels_dir, self.charts_dir, self.charts_rels_dir, self.drawings_dir, self.media_dir, self.embeddings_dir, self.tags_dir, self.notes_dir, self.notes_rels_dir, self.theme_dir, self.diagrams_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def _harvest_shared_parts(self, unique_source_files):
        for pptx_file in unique_source_files:
            with zipfile.ZipFile(pptx_file, 'r') as zf:
                content_types = ET.fromstring(zf.read('[Content_Types].xml'))
                overrides = {node.get('PartName', '').lstrip('/'): node.get('ContentType') for node in content_types.findall(qname(NS_CONTENT_TYPES, 'Override'))}
                defaults = {node.get('Extension', '').lower(): node.get('ContentType') for node in content_types.findall(qname(NS_CONTENT_TYPES, 'Default'))}
                for name in zf.namelist():
                    if name.startswith(SHARED_PART_PREFIXES):
                        dest = self.root / name
                        if not dest.exists():
                            dest.parent.mkdir(parents=True, exist_ok=True)
                            dest.write_bytes(zf.read(name))
                            if name.startswith('ppt/media/'):
                                content_type = overrides.get(name)
                                if content_type:
                                    self.harvested_content_types.append(('override', '/' + name, content_type))
                                elif '.' in dest.name:
                                    extension = dest.suffix.lower().lstrip('.')
                                    content_type = defaults.get(extension)
                                    if content_type:
                                        self.harvested_content_types.append(('default', extension, content_type))

    def _clear_instance_folders(self):
        for clean_folder in INSTANCE_FOLDERS:
            f_path = self.ppt_dir / clean_folder
            if f_path.exists():
                shutil.rmtree(f_path)
            f_path.mkdir(parents=True, exist_ok=True)
            (f_path / '_rels').mkdir(parents=True, exist_ok=True)

    def _load_documents(self):
        self.presentation_path = self.ppt_dir / 'presentation.xml'
        self.relationships_path = self.ppt_dir / '_rels' / 'presentation.xml.rels'
        self.content_types_path = self.root / '[Content_Types].xml'
        self.presentation_tree = ET.parse(self.presentation_path)
        self.presentation_root = self.presentation_tree.getroot()
        self.relationships_tree = ET.parse(self.relationships_path)
        self.relationships_root = self.relationships_tree.getroot()
        self.content_types_tree = ET.parse(self.content_types_path)
        self.content_types_root = self.content_types_tree.getroot()

    def _clear_slide_registrations(self):
        self.slide_id_list = self.presentation_root.find(qname(NS_PRESENTATION, 'sldIdLst'))
        if self.slide_id_list is not None:
            self.slide_id_list.clear()
        else:
            self.slide_id_list = ET.SubElement(self.presentation_root, qname(NS_PRESENTATION, 'sldIdLst'))
        for r in [r for r in self.relationships_root.findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')) if r.get('Type', '').endswith('/slide')]:
            self.relationships_root.remove(r)
        for o in [o for o in self.content_types_root.findall(qname(NS_CONTENT_TYPES, 'Override')) if o.get('PartName', '').startswith('/ppt/slides/slide') or o.get('PartName', '').startswith('/ppt/notesSlides/notesSlide') or o.get('PartName', '').startswith('/ppt/drawings/') or o.get('PartName', '').startswith('/ppt/charts/') or o.get('PartName', '').startswith('/ppt/slides/charts/')]:
            self.content_types_root.remove(o)

    def _prepare_content_types(self):
        self.content_types = ContentTypes(self.content_types_tree)
        for ext, ct in CONTENT_TYPE_DEFAULTS.items():
            self.content_types.ensure_content_type_default(ext, ct)
        for declaration_type, key, content_type in self.harvested_content_types:
            if declaration_type == 'override':
                self.content_types.ensure_content_type_override(key, content_type)
            else:
                self.content_types.ensure_content_type_default(key, content_type)
        for l_path in self.layouts_dir.glob('slideLayout*.xml'):
            self.content_types.ensure_content_type_override(f'/ppt/slideLayouts/{l_path.name}', CT_LAYOUT)

    def _initialize_slide_ids(self):
        relationship_ids = set()
        for r in self.relationships_root.findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
            relationship_value = r.get('Id', '')
            if relationship_value.startswith('rId'):
                try:
                    relationship_ids.add(int(relationship_value[3:]))
                except ValueError:
                    pass
        self.next_relationship_id = max(relationship_ids, default=0) + 1
        self.next_slide_id = FIRST_SLIDE_ID
        self.all_created_slide_ids = []
        used_document_ids = set()
        master_list = self.presentation_root.find(qname(NS_PRESENTATION, 'sldMasterIdLst'))
        if master_list is None:
            master_list = ET.Element(qname(NS_PRESENTATION, 'sldMasterIdLst'))
            self.presentation_root.insert(0, master_list)
        self.master_id_list = master_list
        for element in self.presentation_root.iter():
            if element.tag in (qname(NS_PRESENTATION, 'sldMasterId'), qname(NS_PRESENTATION, 'sldLayoutId')):
                try:
                    used_document_ids.add(int(element.get('id', '')))
                except ValueError:
                    pass
        for master_path in self.masters_dir.glob('slideMaster*.xml'):
            try:
                master_root = ET.parse(master_path).getroot()
            except ET.ParseError:
                continue
            for element in master_root.findall(qname(NS_PRESENTATION, 'sldLayoutIdLst') + '/' + qname(NS_PRESENTATION, 'sldLayoutId')):
                try:
                    used_document_ids.add(int(element.get('id', '')))
                except ValueError:
                    pass
        self.used_master_layout_ids = used_document_ids

    def allocate_master_layout_id(self, minimum):
        candidate = minimum
        while candidate in self.used_master_layout_ids:
            candidate += 1
        self.used_master_layout_ids.add(candidate)
        return candidate

    def register_master(self, master_name):
        relationship_id = f'rId{self.next_relationship_id}'
        self.next_relationship_id += 1
        relationship = ET.SubElement(self.relationships_root, qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship'))
        relationship.set('Id', relationship_id)
        relationship.set('Type', REL_SLIDE_MASTER)
        relationship.set('Target', f'slideMasters/{master_name}')
        master_id = ET.SubElement(self.master_id_list, qname(NS_PRESENTATION, 'sldMasterId'))
        master_id.set('id', str(self.allocate_master_layout_id(2147483648)))
        master_id.set(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'), relationship_id)
        self.content_types.ensure_content_type_override(f'/ppt/slideMasters/{master_name}', CT_MASTER)

    def register_slide(self, new_slide_name):
        relationship_id = f'rId{self.next_relationship_id}'
        self.next_relationship_id += 1
        relationship = ET.SubElement(self.relationships_root, qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship'))
        relationship.set('Id', relationship_id)
        relationship.set('Type', REL_SLIDE)
        relationship.set('Target', f'slides/{new_slide_name}')
        slide_id = ET.SubElement(self.slide_id_list, qname(NS_PRESENTATION, 'sldId'))
        slide_id.set('id', str(self.next_slide_id))
        slide_id.set(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'), relationship_id)
        self.all_created_slide_ids.append(self.next_slide_id)
        self.next_slide_id += 1

    def finalize(self, notes_count):
        sync_presentation_sections(self.presentation_root, self.all_created_slide_ids)
        update_doc_props_app(self.root / 'docProps' / 'app.xml', len(self.all_created_slide_ids), notes_count)
        save_presentation_xml(self.presentation_tree, self.presentation_path)
        save_rels_xml(self.relationships_tree, self.relationships_path)
        save_content_types_xml(self.content_types_tree, self.content_types_path)


# ============================================================================
# assets.py
# ============================================================================

import shutil
import posixpath
import xml.etree.ElementTree as ET

class SlideAssetImporter:
    """Import supported assets using the established first-use layout policy.

    All counters belong to one merge. No global package state is shared.
    """

    def __init__(self, package):
        self.package = package
        self.chart_counter = 0
        self.drawing_counter = 0
        self.embed_counter = 0
        self.media_counter = len(list(self.package.media_dir.glob('*')))
        self.notes_counter = 0
        self.tag_counter = len(list(self.package.tags_dir.glob('tag*.xml')))
        self.theme_override_counter = len(list(self.package.theme_dir.glob('themeOverride*.xml')))
        self.vml_counter = len(list(self.package.drawings_dir.glob('*.vml')))
        self.generic_part_counter = 0
        self.locked_layout_filenames = set()
        self.layout_map = {}
        self.generic_part_map = {}
        self.slide_asset_map = {}
        self.source_content_types = {}

    @staticmethod
    def resolve_source_part(source_root, owner_part, target):
        """Resolve an OPC relationship target inside an extracted package.

        A leading slash means package-root-relative, not filesystem-root-relative.
        Treating it as a normal ``Path`` caused PowerPoint repair warnings because
        notes, charts, and other parts were silently omitted on every platform.
        """
        target = target.split('#', 1)[0]
        if target.startswith('/'):
            return source_root / target.lstrip('/')
        return (owner_part.parent / target).resolve()

    def register_source_content_type(self, source_root, source_part, destination_part):
        """Copy the source part's exact content-type declaration."""
        root_key = source_root.resolve()
        if root_key not in self.source_content_types:
            tree = ET.parse(source_root / '[Content_Types].xml')
            overrides = {}
            defaults = {}
            for node in tree.getroot():
                if node.tag == qname(NS_CONTENT_TYPES, 'Override'):
                    overrides[node.get('PartName')] = node.get('ContentType')
                elif node.tag == qname(NS_CONTENT_TYPES, 'Default'):
                    defaults[node.get('Extension', '').lower()] = node.get('ContentType')
            self.source_content_types[root_key] = (overrides, defaults)
        overrides, defaults = self.source_content_types[root_key]
        source_name = '/' + source_part.relative_to(source_root).as_posix()
        destination_name = '/' + destination_part.relative_to(self.package.root).as_posix()
        if source_name in overrides:
            self.package.content_types.ensure_content_type_override(destination_name, overrides[source_name])
            return
        extension = source_part.suffix.lower().lstrip('.')
        content_type = defaults.get(extension) or CONTENT_TYPE_DEFAULTS.get(extension)
        if content_type:
            self.package.content_types.ensure_content_type_default(extension, content_type)

    @staticmethod
    def relationship_path(part):
        return part.parent / '_rels' / f'{part.name}.rels'

    def relative_target(self, owner, target):
        owner_name = owner.relative_to(self.package.root).as_posix()
        target_name = target.relative_to(self.package.root).as_posix()
        return posixpath.relpath(target_name, posixpath.dirname(owner_name))

    @staticmethod
    def next_number(directory, prefix):
        values = []
        for path in directory.glob(f'{prefix}*.xml'):
            suffix = path.stem[len(prefix):]
            if suffix.isdigit():
                values.append(int(suffix))
        return max(values, default=0) + 1

    def import_generic_part(self, source_root, source_part):
        """Copy one dependency and its relationship graph under collision-safe names."""
        source_part = source_part.resolve()
        key = (source_root.resolve(), source_part)
        existing = self.generic_part_map.get(key)
        if existing is not None:
            return existing
        try:
            relative = source_part.relative_to(source_root)
        except ValueError:
            return None
        self.generic_part_counter += 1
        destination_dir = self.package.root / relative.parent
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / f'imported_{self.generic_part_counter}_{source_part.name}'
        self.generic_part_map[key] = destination
        shutil.copy2(source_part, destination)
        self.register_source_content_type(source_root, source_part, destination)
        source_relationships = self.relationship_path(source_part)
        if source_relationships.exists():
            relationships = ET.parse(source_relationships)
            for relationship in relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
                if relationship.get('TargetMode') == 'External':
                    continue
                dependency = self.resolve_source_part(source_root, source_part, relationship.get('Target', ''))
                if not dependency.exists():
                    continue
                copied = self.import_generic_part(source_root, dependency)
                if copied is not None:
                    relationship.set('Target', self.relative_target(destination, copied))
            destination_relationships = self.relationship_path(destination)
            destination_relationships.parent.mkdir(parents=True, exist_ok=True)
            save_rels_xml(relationships, destination_relationships)
        return destination

    def rewrite_generic_relationships(self, relationships, source_root, source_owner, destination_owner, excluded_types=()):
        excluded = []
        for relationship in list(relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship'))):
            relationship_type = relationship.get('Type', '')
            if any((relationship_type.endswith(value) for value in excluded_types)):
                relationships.getroot().remove(relationship)
                excluded.append(relationship)
                continue
            if relationship.get('TargetMode') == 'External':
                continue
            source_part = self.resolve_source_part(source_root, source_owner, relationship.get('Target', ''))
            if source_part.exists():
                copied = self.import_generic_part(source_root, source_part)
                if copied is not None:
                    relationship.set('Target', self.relative_target(destination_owner, copied))
        return excluded

    def import_layout_dependencies(self, source_layout_path):
        """Copy layout-level media when the compatible shared layout is reused."""
        relationships_path = self.relationship_path(source_layout_path)
        if not relationships_path.exists():
            return
        relationships = ET.parse(relationships_path)
        for relationship in relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
            relationship_type = relationship.get('Type', '')
            target = relationship.get('Target', '')
            if 'image' not in relationship_type and '/media/' not in target.replace('\\', '/'):
                continue
            source_media = self.resolve_source_part(source_layout_path.parents[2], source_layout_path, target)
            if source_media.exists():
                destination_media = self.package.media_dir / source_media.name
                if not destination_media.exists():
                    shutil.copy2(source_media, destination_media)
                self.register_source_content_type(source_layout_path.parents[2], source_media, destination_media)
        save_rels_xml(relationships, self.package.layouts_rels_dir / f'{source_layout_path.name}.rels')

    def layout_master_target(self, layout_path):
        relationships_path = self.relationship_path(layout_path)
        if not relationships_path.exists():
            return None
        relationships = ET.parse(relationships_path)
        for relationship in relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
            if relationship.get('Type', '').endswith('/slideMaster'):
                return relationship.get('Target')
        return None

    def import_relationships(self, src_slide, source_root, source_identity, slide_link_map, new_slide_name, slide_index):
        source_slides_dir = source_root / 'ppt' / 'slides'
        source_rels = source_slides_dir / '_rels' / f'{src_slide.name}.rels'
        if not source_rels.exists():
            return
        tree = ET.parse(source_rels)
        removed_slide_relationships = set()
        for rel in tree.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
            kind = rel.get('Type', '').split('/')[-1]
            target = rel.get('Target', '')
            if 'slideLayout' in kind:
                self.import_layout(source_root, src_slide, target, rel)
            elif kind == 'slide':
                source_target = self.resolve_source_part(source_root, src_slide, target)
                try:
                    source_part = source_target.relative_to(source_root).as_posix()
                except ValueError:
                    source_part = None
                destination_name = slide_link_map.get((source_identity, source_part))
                if destination_name:
                    rel.set('Target', destination_name)
                else:
                    removed_slide_relationships.add(rel.get('Id'))
                    tree.getroot().remove(rel)
            elif 'chart' in kind and 'chartUserShapes' not in kind:
                self.import_chart(source_root, src_slide, target, rel, slide_index)
            elif kind.startswith('diagram'):
                self.import_generic_relationship(source_root, src_slide, target, rel)
            elif kind in ('image', 'media', 'video', 'audio'):
                self.import_media(source_root, src_slide, target, rel, slide_index)
            elif 'oleObject' in kind or 'package' in kind:
                self.import_embedding(source_root, src_slide, target, rel, slide_index)
            elif 'vmlDrawing' in kind or target.lower().endswith('.vml'):
                self.import_vml(source_root, src_slide, target, rel, slide_index)
            elif 'tags' in kind:
                self.import_tag(source_root, src_slide, target, rel, slide_index)
            elif 'notesSlide' in kind:
                self.import_notes(source_root, src_slide, target, rel, slide_index, new_slide_name)
        save_rels_xml(tree, self.package.slides_rels_dir / f'{new_slide_name}.rels')
        if removed_slide_relationships:
            self.remove_slide_relationship_references(self.package.slides_dir / new_slide_name, removed_slide_relationships)

    @staticmethod
    def remove_slide_relationship_references(slide_path, relationship_ids):
        """Remove hyperlink markup when its destination slide was not selected."""
        tree = ET.parse(slide_path)
        root = tree.getroot()
        parents = {child: parent for parent in root.iter() for child in parent}
        relationship_attribute = qname(NS_DOCUMENT_RELATIONSHIPS, 'id')
        for element in list(root.iter()):
            if element.get(relationship_attribute) not in relationship_ids:
                continue
            if element.tag.rsplit('}', 1)[-1] in ('hlinkClick', 'hlinkMouseOver'):
                parent = parents.get(element)
                if parent is not None:
                    parent.remove(element)
            else:
                element.attrib.pop(relationship_attribute, None)
        tree.write(slide_path, xml_declaration=True, encoding='utf-8')

    def import_layout(self, source_root, owner_part, target, rel):
        source_layout = self.resolve_source_part(source_root, owner_part, target)
        if not source_layout.exists():
            if (self.package.layouts_dir / 'slideLayout1.xml').exists():
                rel.set('Target', '../slideLayouts/slideLayout1.xml')
            return
        key = (source_root.resolve(), source_layout.resolve())
        destination_layout = self.layout_map.get(key)
        same_name = self.package.layouts_dir / source_layout.name
        if destination_layout is None and same_name.exists():
            source_master_target = self.layout_master_target(source_layout)
            destination_master_target = self.layout_master_target(same_name)
            if source_master_target == destination_master_target:
                if source_layout.name not in self.locked_layout_filenames:
                    if source_layout.read_bytes() != same_name.read_bytes():
                        shutil.copy2(source_layout, same_name)
                        self.import_layout_dependencies(source_layout)
                    self.locked_layout_filenames.add(source_layout.name)
                destination_layout = same_name
                self.layout_map[key] = destination_layout
        if destination_layout is None:
            destination_layout = self.import_layout_with_master(source_root, source_layout)
            self.layout_map[key] = destination_layout
        rel.set('Target', f'../slideLayouts/{destination_layout.name}')

    def import_layout_with_master(self, source_root, source_layout):
        """Import a colliding layout with an isolated one-layout slide master."""
        source_layout_relationships_path = self.relationship_path(source_layout)
        if not source_layout_relationships_path.exists():
            raise ValueError(f'Slide layout has no relationships: {source_layout}')
        layout_relationships = ET.parse(source_layout_relationships_path)
        master_relationship = next((relationship for relationship in layout_relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')) if relationship.get('Type', '').endswith('/slideMaster')), None)
        if master_relationship is None:
            raise ValueError(f'Slide layout has no slide-master backlink: {source_layout}')
        source_master = self.resolve_source_part(source_root, source_layout, master_relationship.get('Target', ''))
        if not source_master.exists():
            raise ValueError(f'Slide layout master is missing: {source_master}')
        layout_name = f"slideLayout{self.next_number(self.package.layouts_dir, 'slideLayout')}.xml"
        master_name = f"slideMaster{self.next_number(self.package.masters_dir, 'slideMaster')}.xml"
        destination_layout = self.package.layouts_dir / layout_name
        destination_master = self.package.masters_dir / master_name
        shutil.copy2(source_layout, destination_layout)
        shutil.copy2(source_master, destination_master)
        self.register_source_content_type(source_root, source_layout, destination_layout)
        self.register_source_content_type(source_root, source_master, destination_master)
        self.rewrite_generic_relationships(layout_relationships, source_root, source_layout, destination_layout, excluded_types=('/slideMaster',))
        master_relationship.set('Target', f'../slideMasters/{master_name}')
        layout_relationships.getroot().append(master_relationship)
        save_rels_xml(layout_relationships, self.package.layouts_rels_dir / f'{layout_name}.rels')
        source_master_relationships_path = self.relationship_path(source_master)
        if source_master_relationships_path.exists():
            master_relationships = ET.parse(source_master_relationships_path)
        else:
            master_relationships = ET.ElementTree(ET.Element(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationships')))
        self.rewrite_generic_relationships(master_relationships, source_root, source_master, destination_master, excluded_types=('/slideLayout',))
        used_relationship_ids = {relationship.get('Id') for relationship in master_relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship'))}
        suffix = 1
        layout_relationship_id = f'rIdImportedLayout{suffix}'
        while layout_relationship_id in used_relationship_ids:
            suffix += 1
            layout_relationship_id = f'rIdImportedLayout{suffix}'
        imported_layout_relationship = ET.SubElement(master_relationships.getroot(), qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship'))
        imported_layout_relationship.set('Id', layout_relationship_id)
        imported_layout_relationship.set('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout')
        imported_layout_relationship.set('Target', f'../slideLayouts/{layout_name}')
        save_rels_xml(master_relationships, self.package.masters_rels_dir / f'{master_name}.rels')
        master_tree = ET.parse(destination_master)
        master_root = master_tree.getroot()
        layout_id_list = master_root.find(qname(NS_PRESENTATION, 'sldLayoutIdLst'))
        if layout_id_list is None:
            layout_id_list = ET.Element(qname(NS_PRESENTATION, 'sldLayoutIdLst'))
            master_root.insert(0, layout_id_list)
        else:
            layout_id_list.clear()
        layout_id = ET.SubElement(layout_id_list, qname(NS_PRESENTATION, 'sldLayoutId'))
        layout_id.set('id', str(self.package.allocate_master_layout_id(2147483649)))
        layout_id.set(qname(NS_DOCUMENT_RELATIONSHIPS, 'id'), layout_relationship_id)
        master_tree.write(destination_master, xml_declaration=True, encoding='utf-8')
        self.package.register_master(master_name)
        return destination_layout

    def import_generic_relationship(self, source_root, owner_part, target, rel):
        source_part = self.resolve_source_part(source_root, owner_part, target)
        if source_part.exists():
            destination = self.import_generic_part(source_root, source_part)
            if destination is not None:
                rel.set('Target', self.relative_target(self.package.slides_dir / owner_part.name, destination))

    def import_chart(self, source_root, owner_part, target, rel, slide_index):
        source_chart = self.resolve_source_part(source_root, owner_part, target)
        if source_chart.exists():
            self.chart_counter += 1
            chart_name = f'chart{self.chart_counter}.xml'
            shutil.copy2(source_chart, self.package.charts_dir / chart_name)
            self.package.content_types.ensure_content_type_override(f'/ppt/charts/{chart_name}', CT_CHART)
            chart_relationships_path = source_chart.parent / '_rels' / f'{source_chart.name}.rels'
            if chart_relationships_path.exists():
                chart_relationships = ET.parse(chart_relationships_path)
                for chart_relationship in chart_relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
                    chart_target = chart_relationship.get('Target', '')
                    chart_relationship_type = chart_relationship.get('Type', '')
                    if 'themeOverride' in chart_relationship_type or 'themeOverride' in chart_target:
                        source_theme = self.resolve_source_part(source_root, source_chart, chart_target)
                        if source_theme.exists():
                            self.theme_override_counter += 1
                            theme_name = f'themeOverride{self.theme_override_counter}.xml'
                            shutil.copy2(source_theme, self.package.theme_dir / theme_name)
                            self.package.content_types.ensure_content_type_override(f'/ppt/theme/{theme_name}', CT_THEME_OVERRIDE)
                            chart_relationship.set('Target', f'../theme/{theme_name}')
                    elif 'package' in chart_relationship_type or 'oleObject' in chart_relationship_type:
                        if chart_relationship.get('TargetMode') != 'External':
                            source_embedding = self.resolve_source_part(source_root, source_chart, chart_target)
                            if source_embedding.exists() and 'embeddings' in str(source_embedding):
                                self.embed_counter += 1
                                embedding_name = f'embed_{self.chart_counter}_{self.embed_counter}_{source_embedding.name}'
                                shutil.copy2(source_embedding, self.package.embeddings_dir / embedding_name)
                                chart_relationship.set('Target', f'../embeddings/{embedding_name}')
                                ext = source_embedding.suffix.lower()
                                if ext in CONTENT_TYPE_DEFAULTS:
                                    self.package.content_types.ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                    elif 'chartUserShapes' in chart_relationship_type or 'drawings' in chart_target:
                        source_drawing = self.resolve_source_part(source_root, source_chart, chart_target)
                        if source_drawing.exists():
                            self.drawing_counter += 1
                            drawing_name = f'drawing{self.drawing_counter}.xml'
                            shutil.copy2(source_drawing, self.package.drawings_dir / drawing_name)
                            self.package.content_types.ensure_content_type_override(f'/ppt/drawings/{drawing_name}', CT_CHART_DRAWING)
                            chart_relationship.set('Target', f'../drawings/{drawing_name}')
                    elif 'chartStyle' in chart_relationship_type or 'style' in chart_target:
                        source_style = self.resolve_source_part(source_root, source_chart, chart_target)
                        if source_style.exists():
                            style_name = f'style_{self.chart_counter}_{source_style.name}'
                            shutil.copy2(source_style, self.package.charts_dir / style_name)
                            self.package.content_types.ensure_content_type_override(f'/ppt/charts/{style_name}', CT_CHART_STYLE)
                            chart_relationship.set('Target', style_name)
                    elif 'chartColorStyle' in chart_relationship_type or 'colors' in chart_target:
                        source_colors = self.resolve_source_part(source_root, source_chart, chart_target)
                        if source_colors.exists():
                            color_name = f'colors_{self.chart_counter}_{source_colors.name}'
                            shutil.copy2(source_colors, self.package.charts_dir / color_name)
                            self.package.content_types.ensure_content_type_override(f'/ppt/charts/{color_name}', CT_CHART_COLOR_STYLE)
                            chart_relationship.set('Target', color_name)
                    elif chart_relationship_type.endswith(('/image', '/media', '/video', '/audio')):
                        self.import_media(source_root, source_chart, chart_target, chart_relationship, slide_index)
                save_rels_xml(chart_relationships, self.package.charts_rels_dir / f'{chart_name}.rels')
            rel.set('Target', f'../charts/{chart_name}')

    def import_media(self, source_root, owner_part, target, rel, slide_index):
        source_media = self.resolve_source_part(source_root, owner_part, target)
        if source_media.exists():
            key = (slide_index, source_media.resolve())
            media_name = self.slide_asset_map.get(key)
            if media_name is None:
                self.media_counter += 1
                media_name = f'image_{slide_index}_{self.media_counter}_{source_media.name}'
                destination = self.package.media_dir / media_name
                shutil.copy2(source_media, destination)
                self.register_source_content_type(source_root, source_media, destination)
                self.slide_asset_map[key] = media_name
            rel.set('Target', f'../media/{media_name}')

    def import_embedding(self, source_root, owner_part, target, rel, slide_index):
        if rel.get('TargetMode') != 'External':
            source_embedding = self.resolve_source_part(source_root, owner_part, target)
            if source_embedding.exists():
                self.embed_counter += 1
                embedding_name = f'ole_{slide_index}_{self.embed_counter}_{source_embedding.name}'
                shutil.copy2(source_embedding, self.package.embeddings_dir / embedding_name)
                self.register_source_content_type(source_root, source_embedding, self.package.embeddings_dir / embedding_name)
                rel.set('Target', f'../embeddings/{embedding_name}')

    def import_tag(self, source_root, owner_part, target, rel, slide_index):
        source_tag = self.resolve_source_part(source_root, owner_part, target)
        if source_tag.exists():
            self.tag_counter += 1
            tag_name = f'tag_{slide_index}_{self.tag_counter}.xml'
            shutil.copy2(source_tag, self.package.tags_dir / tag_name)
            self.package.content_types.ensure_content_type_override(f'/ppt/tags/{tag_name}', CT_TAGS)
            rel.set('Target', f'../tags/{tag_name}')

    def import_vml(self, source_root, owner_part, target, rel, slide_index):
        source_vml = self.resolve_source_part(source_root, owner_part, target)
        if not source_vml.exists():
            return
        self.vml_counter += 1
        vml_name = f'drawing{self.vml_counter}.vml'
        destination = self.package.drawings_dir / vml_name
        shutil.copy2(source_vml, destination)
        self.register_source_content_type(source_root, source_vml, destination)
        source_rels = source_vml.parent / '_rels' / f'{source_vml.name}.rels'
        if source_rels.exists():
            relationships = ET.parse(source_rels)
            for relationship in relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
                kind = relationship.get('Type', '').split('/')[-1]
                if kind in ('image', 'media', 'video', 'audio'):
                    self.import_media(source_root, source_vml, relationship.get('Target', ''), relationship, slide_index)
            save_rels_xml(relationships, self.package.drawings_dir / '_rels' / f'{vml_name}.rels')
        rel.set('Target', f'../drawings/{vml_name}')

    def import_notes(self, source_root, owner_part, target, rel, slide_index, new_slide_name):
        source_notes = self.resolve_source_part(source_root, owner_part, target)
        if source_notes.exists():
            self.notes_counter += 1
            notes_name = f'notesSlide{slide_index}.xml'
            shutil.copy2(source_notes, self.package.notes_dir / notes_name)
            self.package.content_types.ensure_content_type_override(f'/ppt/notesSlides/{notes_name}', CT_NOTES)
            notes_relationships_path = source_notes.parent / '_rels' / f'{source_notes.name}.rels'
            if notes_relationships_path.exists():
                notes_relationships = ET.parse(notes_relationships_path)
                for notes_relationship in notes_relationships.getroot().findall(qname(NS_PACKAGE_RELATIONSHIPS, 'Relationship')):
                    if notes_relationship.get('Type', '').endswith('/slide'):
                        notes_relationship.set('Target', f'../slides/{new_slide_name}')
                save_rels_xml(notes_relationships, self.package.notes_rels_dir / f'{notes_name}.rels')
            rel.set('Target', f'../notesSlides/{notes_name}')


# ============================================================================
# writer.py
# ============================================================================

from pathlib import Path
import os
import tempfile
import zipfile

def write_package(package_root: Path, output: Path) -> None:
    """Write beside the output, then replace it only after the ZIP closes successfully."""
    output = Path(output)
    staged = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.pptx-merge-', suffix='.tmp', dir=output.parent, delete=False) as handle:
            staged = Path(handle.name)
        with zipfile.ZipFile(staged, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for root, _, files in os.walk(package_root):
                for name in files:
                    path = Path(root) / name
                    archive.write(path, arcname=str(path.relative_to(package_root)))
        os.replace(staged, output)
    finally:
        if staged is not None and staged.exists():
            staged.unlink()


# ============================================================================
# engine.py
# ============================================================================

from pathlib import Path
import shutil
import tempfile
import zipfile

def selected_slides(source_root, spec):
    """Resolve a single recipe entry, retaining order, duplicates, and hidden filtering."""
    slides_dir = source_root / 'ppt' / 'slides'
    if not slides_dir.exists():
        return []
    canonical = get_presentation_slide_paths(source_root)
    if not canonical:
        return []
    try:
        indices = parse_slide_selection(spec['slides'], len(canonical))
    except Exception as exc:
        print(f"[ERROR] Invalid slide range for {spec['file'].name}: {exc}")
        raise
    return [canonical[index] for index in indices if 0 <= index < len(canonical) and (not (spec['skip_hidden'] and is_slide_hidden(canonical[index])))]

def merge_pptx_files_autonomous(input_pptx_files, output_pptx_path):
    """Merge ordered file/range specifications or JSON recipes; return the output Path.

    This refactor retains the legacy asset and selection policies. See README
    for supported workflows and known fidelity limits across unrelated decks.
    """
    specs = normalize_inputs(input_pptx_files)
    output = Path(output_pptx_path)
    sources = unique_sources(specs)
    if not sources:
        raise ValueError('No input PPTX files provided by the recipe.')
    for source in sources:
        validate_pptx_source(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pptx_merge_') as temporary:
        temporary = Path(temporary)
        planned_slides = []
        slide_link_map = {}
        for source_index, spec in enumerate(specs, start=1):
            source_root = temporary / f'source_{source_index}'
            source_root.mkdir()
            with zipfile.ZipFile(spec['file']) as archive:
                archive.extractall(source_root)
            source_identity = str(spec['file'].resolve())
            for source_slide in selected_slides(source_root, spec):
                destination_name = f'slide{len(planned_slides) + 1}.xml'
                source_part = source_slide.relative_to(source_root).as_posix()
                slide_link_map.setdefault((source_identity, source_part), destination_name)
                planned_slides.append((source_slide, source_root, source_identity, destination_name))
        package = MergeWorkspace(temporary / 'merged', sources)
        importer = SlideAssetImporter(package)
        for slide_count, (source_slide, source_root, source_identity, name) in enumerate(planned_slides, start=1):
            shutil.copy2(source_slide, package.slides_dir / name)
            package.content_types.ensure_content_type_override(f'/ppt/slides/{name}', CT_SLIDE)
            importer.import_relationships(source_slide, source_root, source_identity, slide_link_map, name, slide_count)
            package.register_slide(name)
        slide_count = len(planned_slides)
        package.finalize(importer.notes_counter)
        write_package(package.root, output)
    print(f'[SUCCESS] Autonomous merged presentation created: {output}')
    print(f'[SUCCESS] Total slides merged: {slide_count}')
    return output

def merge_from_json(json_recipe_path, output_pptx_path):
    """Merge a JSON recipe using the same pipeline as direct input specifications."""
    return merge_pptx_files_autonomous(json_recipe_path, output_pptx_path)


# ============================================================================
# cli.py
# ============================================================================

from pathlib import Path
import argparse
import sys
from zipfile import BadZipFile

def parse_cli_args(argv=None):
    """Command Line Interface argument parser."""
    parser = argparse.ArgumentParser(description='Autonomous Platform-Independent PowerPoint (.pptx) Slide Merger')
    parser.add_argument('positional_inputs', nargs='*', help="Optional positional inputs (e.g. 'recipe.json', 'deck1.pptx:1-3', or list of pptx files)")
    parser.add_argument('-i', '--inputs', nargs='+', help="Input files, slide specs (e.g. 'deck1.pptx:1-3,5' 'deck2.pptx:2,4'), or JSON recipe file")
    parser.add_argument('-d', '--dir', help='Input directory containing .pptx presentations to merge in natural sort order')
    parser.add_argument('-r', '-c', '--recipe', '--config', help='JSON recipe/manifest file describing the presentations and slide ranges to merge')
    parser.add_argument('-o', '--output', default=DEFAULT_OUTPUT_NAME, help='Destination path for the merged .pptx presentation (default: merged_output_autonomous.pptx)')
    return parser.parse_args(argv)

def main(argv=None, *, base_dir=None):
    args = parse_cli_args(argv)
    base_dir = Path(base_dir) if base_dir is not None else Path.cwd()
    inputs_to_process = []
    if args.recipe:
        inputs_to_process = args.recipe
    elif args.inputs:
        inputs_to_process = args.inputs
    elif args.positional_inputs:
        if len(args.positional_inputs) == 1 and args.positional_inputs[0].lower().endswith('.json'):
            inputs_to_process = args.positional_inputs[0]
        else:
            inputs_to_process = args.positional_inputs
    elif args.dir:
        input_dir = Path(args.dir).resolve()
        inputs_to_process = sorted(input_dir.glob('*.pptx'), key=natural_sort_key)
    else:
        default_dir = (base_dir / DEFAULT_INPUT_DIRECTORY).resolve()
        if default_dir.exists():
            inputs_to_process = sorted(default_dir.glob('*.pptx'), key=natural_sort_key)
            print(f'[Autonomous Merger] Using default input directory: {default_dir}')
        else:
            inputs_to_process = sorted(base_dir.glob('*.pptx'), key=natural_sort_key)
    output_path = Path(args.output).resolve()
    print(f'[Autonomous Merger] Output file: {output_path}')
    try:
        merge_pptx_files_autonomous(inputs_to_process, output_path)
    except (BadZipFile, PptxValidationError) as exc:
        print(f'[ERROR] {exc}', file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
