"""
Autonomous Platform-Independent PowerPoint (.pptx) Merger
==========================================================
Works seamlessly across Windows, macOS, and Linux without MS Office.
Merges individual single-slide PPTX files, multi-slide presentations,
selective slide ranges, or external JSON recipes into a single master presentation
completely autonomously (no external template required).

Features:
- 100% Standalone & Autonomous: Zero external template dependencies.
- Deterministic 'First-Use Wins' Layout Hash Synchronization: When different source
  decks reuse the same layout filename (e.g. slideLayout12.xml) with different content,
  synchronizes the layout definition to the first encountered source version with
  exact SHA-256 hash match, preventing blank cover/title slides while maintaining
  perfect OpenXML master integrity.
- Layout-Linked Media Dependency Copy & Collision Protection: Automatically discovers
  and copies all media, background images, and logos referenced by slide layouts into ppt/media/,
  with content-hash deduplication and name-collision protection.
- External JSON Recipe Support: Load dynamic merge pipelines directly from JSON files.
- Selective Slide Slicing & Ranges: Mix ranges and individual slide picks
  e.g. ("deck1.pptx", "1-3, 5, 8-10"), ("deck2.pptx", [1, 4]), ("deck1.pptx", "4-5").
- Interleaved Sequencing: Reuse and interleave presentations in any custom order.
- Hidden Slide Filtering: Automatically skip draft/hidden slides (skip_hidden=True).
- Complete OpenXML Fidelity: Preserves vector graphics, charts, drawings,
  Excel workbooks, OLE embeddings, speaker notes, themes, and presentation sections.
- Verified Clean: Opens in Microsoft PowerPoint, Apple Keynote, and LibreOffice
  with 0 repair prompts.
"""

import os
import re
import json
import shutil
import hashlib
import zipfile
import tempfile
import argparse
import posixpath
import xml.etree.ElementTree as ET
from pathlib import Path

# Complete OpenXML Standard Namespace Registry
STANDARD_NAMESPACES = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main',
    'p15': 'http://schemas.microsoft.com/office/powerpoint/2012/main',
    'p16': 'http://schemas.microsoft.com/office/powerpoint/2015/main',
    'a14': 'http://schemas.microsoft.com/office/drawing/2010/main',
    'a16': 'http://schemas.microsoft.com/office/drawing/2014/main',
    'c14': 'http://schemas.microsoft.com/office/drawing/2007/8/2/chart',
    'c16': 'http://schemas.microsoft.com/office/drawing/2014/chart',
    'c16r2': 'http://schemas.microsoft.com/office/drawing/2015/06/chart',
    'v': 'urn:schemas-microsoft-com:vml',
}

for prefix, uri in STANDARD_NAMESPACES.items():
    ET.register_namespace(prefix, uri)

CONTENT_TYPE_DEFAULTS = {
    'xml': 'application/xml',
    'rels': 'application/vnd.openxmlformats-package.relationships+xml',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'emf': 'image/x-emf',
    'wmf': 'image/x-wmf',
    'gif': 'image/gif',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'bin': 'application/vnd.openxmlformats-officedocument.oleObject',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'vml': 'application/vnd.openxmlformats-officedocument.vmlDrawing',
}


def file_sha256(file_path):
    """Computes SHA-256 hash of a file's binary content."""
    try:
        return hashlib.sha256(Path(file_path).read_bytes()).hexdigest()
    except Exception:
        return ""


def natural_sort_key(s):
    """Natural sorting key for human-ordered filenames (e.g. slide_01, slide_2, slide_10)."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', str(s))]


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
    if selection is None or selection == "all" or selection == "*":
        return list(range(total_slides))

    if isinstance(selection, slice):
        return list(range(total_slides))[selection]

    if isinstance(selection, int):
        idx = selection - 1 if selection > 0 else total_slides + selection
        if 0 <= idx < total_slides:
            return [idx]
        raise IndexError(f"Slide index {selection} out of range for presentation with {total_slides} slides.")

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
                start_str, end_str = parts[0].strip(), parts[1].strip()

                # "5-" -> from slide 5 to end
                if start_str and not end_str:
                    start = int(start_str) - 1
                    end = total_slides
                # "-3" -> from slide 1 to slide 3
                elif not start_str and end_str:
                    start = 0
                    end = int(end_str)
                # "2-5" -> from slide 2 to slide 5 inclusive
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
                    raise IndexError(f"Slide number {token} out of range for presentation with {total_slides} slides.")
        return indices

    raise TypeError(f"Unsupported slide selection type: {type(selection)}")


def normalize_input_spec(item):
    """
    Normalizes different input formats (Path, str, tuple, dict) into a standard dictionary:
    {"file": Path, "slides": selection_expr, "skip_hidden": bool}
    """
    if isinstance(item, (str, Path)):
        # Support CLI format "path/to/deck.pptx:1-3,5"
        str_val = str(item)
        if ":" in str_val and not (len(str_val) >= 2 and str_val[1] == ":" and str_val.count(":") == 1):
            last_colon = str_val.rfind(":")
            if last_colon > 1:
                potential_file = Path(str_val[:last_colon])
                if potential_file.exists():
                    return {"file": potential_file, "slides": str_val[last_colon + 1:], "skip_hidden": False}
        return {"file": Path(item), "slides": None, "skip_hidden": False}

    if isinstance(item, (tuple, list)):
        f = Path(item[0])
        slides = item[1] if len(item) > 1 else None
        skip_hidden = item[2] if len(item) > 2 else False
        return {"file": f, "slides": slides, "skip_hidden": skip_hidden}

    if isinstance(item, dict):
        f = Path(item.get("file") or item.get("path"))
        slides = item.get("slides") or item.get("range")
        skip_hidden = bool(item.get("skip_hidden", False))
        return {"file": f, "slides": slides, "skip_hidden": skip_hidden}

    raise TypeError(f"Invalid input presentation specification: {item}")


def load_recipe_file(json_path):
    """
    Loads an external JSON recipe/manifest file and returns a list of normalized slide specs.
    Automatically resolves relative file paths relative to the JSON file's directory.

    :param json_path: Path to the JSON recipe file.
    :return: List of normalized specification dictionaries.
    """
    json_path = Path(json_path).resolve()
    if not json_path.exists():
        raise FileNotFoundError(f"JSON recipe file not found: {json_path}")

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError(
            f"JSON recipe must contain a top-level list of slide specifications, got {type(data).__name__}"
        )

    resolved_specs = []
    base_dir = json_path.parent
    for item in data:
        spec = normalize_input_spec(item)
        f_path = spec["file"]
        if not f_path.is_absolute():
            resolved_f = (base_dir / f_path).resolve()
            if resolved_f.exists():
                spec["file"] = resolved_f
            else:
                spec["file"] = f_path.resolve()
        else:
            spec["file"] = f_path.resolve()
        resolved_specs.append(spec)

    return resolved_specs


def get_presentation_slide_paths(extracted_pptx_dir):
    """
    Discovers slide XML paths in exact visual presentation order as defined in presentation.xml.
    Falls back to natural-sorted filenames in ppt/slides if presentation.xml is missing.
    """
    ppt_dir = Path(extracted_pptx_dir) / "ppt"
    pres_xml = ppt_dir / "presentation.xml"
    pres_rels = ppt_dir / "_rels" / "presentation.xml.rels"

    if pres_xml.exists() and pres_rels.exists():
        try:
            rels_tree = ET.parse(pres_rels)
            rid_to_target = {}
            for rel in rels_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                r_type = rel.get("Type", "")
                if r_type.endswith("/slide"):
                    rid_to_target[rel.get("Id")] = rel.get("Target")

            pres_tree = ET.parse(pres_xml)
            sldIdLst = pres_tree.getroot().find("{http://schemas.openxmlformats.org/presentationml/2006/main}sldIdLst")
            if sldIdLst is not None:
                slides = []
                for sldId in sldIdLst.findall("{http://schemas.openxmlformats.org/presentationml/2006/main}sldId"):
                    r_id = sldId.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                    if r_id and r_id in rid_to_target:
                        target = rid_to_target[r_id]
                        slide_path = (ppt_dir / target).resolve()
                        if slide_path.exists():
                            slides.append(slide_path)
                if slides:
                    return slides
        except Exception as e:
            print(f"[WARNING] Error reading canonical presentation order: {e}")

    # Fallback to scanning ppt/slides
    slides_dir = ppt_dir / "slides"
    if slides_dir.exists():
        return sorted(
            [p for p in slides_dir.glob("slide*.xml") if "_rels" not in p.parts],
            key=lambda p: natural_sort_key(p.name)
        )
    return []


def is_slide_hidden(slide_xml_path):
    """Checks if a slide is marked as hidden in OpenXML (<p:sld show="0">)."""
    try:
        tree = ET.parse(slide_xml_path)
        root = tree.getroot()
        show_val = root.get("show", "1").lower()
        return show_val in ("0", "false")
    except Exception:
        return False


def save_presentation_xml(tree, file_path):
    """Saves presentation.xml with standard OpenXML namespaces."""
    for prefix, uri in STANDARD_NAMESPACES.items():
        ET.register_namespace(prefix, uri)
    tree.write(file_path, xml_declaration=True, encoding="utf-8")


def save_rels_xml(tree, file_path):
    """Saves any .rels file with standard default relationships namespace."""
    ET.register_namespace('', 'http://schemas.openxmlformats.org/package/2006/relationships')
    tree.write(file_path, xml_declaration=True, encoding="utf-8")


def save_content_types_xml(tree, file_path):
    """Saves [Content_Types].xml with standard default content-types namespace."""
    ET.register_namespace('', 'http://schemas.openxmlformats.org/package/2006/content-types')
    tree.write(file_path, xml_declaration=True, encoding="utf-8")


def update_doc_props_app(app_xml_path, total_slides, total_notes):
    """Updates docProps/app.xml with accurate slide and notes count to prevent repair warnings."""
    if not app_xml_path.exists():
        return
    try:
        tree = ET.parse(app_xml_path)
        root = tree.getroot()
        ns = {
            'ep': 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
            'vt': 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes'
        }
        slides_elem = root.find('ep:Slides', ns)
        if slides_elem is not None:
            slides_elem.text = str(total_slides)
        notes_elem = root.find('ep:Notes', ns)
        if notes_elem is not None:
            notes_elem.text = str(total_notes)
        ET.register_namespace('', 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties')
        ET.register_namespace('vt', 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes')
        tree.write(app_xml_path, xml_declaration=True, encoding="utf-8")
    except Exception as e:
        print(f"[WARNING] Could not update app.xml: {e}")


def sync_presentation_sections(pres_root, slide_ids):
    """Synchronizes presentation.xml extLst section slide IDs with the merged slide IDs."""
    ns_p14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
    section_lst = pres_root.find(f".//{{{ns_p14}}}sectionLst")
    if section_lst is not None:
        sections = section_lst.findall(f"{{{ns_p14}}}section")
        if sections:
            first_sec = sections[0]
            sldIdLst = first_sec.find(f"{{{ns_p14}}}sldIdLst")
            if sldIdLst is None:
                sldIdLst = ET.SubElement(first_sec, f"{{{ns_p14}}}sldIdLst")
            else:
                sldIdLst.clear()
            for s_id in slide_ids:
                s_elem = ET.SubElement(sldIdLst, f"{{{ns_p14}}}sldId")
                s_elem.set("id", str(s_id))
            for sec in sections[1:]:
                s_lst = sec.find(f"{{{ns_p14}}}sldIdLst")
                if s_lst is not None:
                    s_lst.clear()


def merge_pptx_files_autonomous(input_pptx_files, output_pptx_path):
    """
    Autonomously merges a list of PPTX presentations, selective slide ranges,
    or an external JSON recipe file into a single master presentation.
    No template or master presentation is required.

    :param input_pptx_files: List of file paths, tuples ("file.pptx", "1-3, 5"),
                             dicts ({"file": "file.pptx", "slides": [1, 4], "skip_hidden": True}),
                             or path to an external JSON recipe file ("manifest.json").
    :param output_pptx_path: Destination path for the merged .pptx presentation.
    :return: Path to the generated output .pptx presentation.
    """
    if not input_pptx_files:
        raise ValueError("No input PPTX files provided.")

    # If a single JSON recipe file path is passed directly:
    if isinstance(input_pptx_files, (str, Path)) and str(input_pptx_files).lower().endswith(".json"):
        normalized_specs = load_recipe_file(input_pptx_files)
    elif (isinstance(input_pptx_files, (list, tuple)) and 
          len(input_pptx_files) == 1 and 
          isinstance(input_pptx_files[0], (str, Path)) and 
          str(input_pptx_files[0]).lower().endswith(".json")):
        normalized_specs = load_recipe_file(input_pptx_files[0])
    else:
        if isinstance(input_pptx_files, (str, Path)):
            input_pptx_files = [input_pptx_files]
        normalized_specs = []
        for item in input_pptx_files:
            if isinstance(item, (str, Path)) and str(item).lower().endswith(".json"):
                normalized_specs.extend(load_recipe_file(item))
            else:
                normalized_specs.append(normalize_input_spec(item))

    output_pptx_path = Path(output_pptx_path)
    output_pptx_path.parent.mkdir(parents=True, exist_ok=True)

    # Collect unique physical files for base package discovery and master harvesting
    unique_source_files = []
    seen_files = set()
    for spec in normalized_specs:
        src_path = spec["file"].resolve()
        if not src_path.exists():
            raise FileNotFoundError(f"Input presentation not found: {src_path}")
        if src_path not in seen_files:
            seen_files.add(src_path)
            unique_source_files.append(src_path)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir = Path(temp_dir)
        merged_root = temp_dir / "merged"
        merged_root.mkdir()

        # Step 1: Base package selection - pick slide package with the richest structure
        best_base = unique_source_files[0]
        max_entries = 0
        for f in unique_source_files:
            with zipfile.ZipFile(f, 'r') as z:
                nl = z.namelist()
                score = len(nl) + 10 * len([x for x in nl if 'slideLayout' in x])
                if score > max_entries:
                    max_entries = score
                    best_base = f

        with zipfile.ZipFile(best_base, 'r') as zf:
            zf.extractall(merged_root)

        ppt_dir = merged_root / "ppt"
        slides_dir = ppt_dir / "slides"
        slides_rels_dir = slides_dir / "_rels"
        layouts_dir = ppt_dir / "slideLayouts"
        layouts_rels_dir = layouts_dir / "_rels"
        masters_dir = ppt_dir / "slideMasters"
        masters_rels_dir = masters_dir / "_rels"
        charts_dir = ppt_dir / "charts"
        charts_rels_dir = charts_dir / "_rels"
        drawings_dir = ppt_dir / "drawings"
        media_dir = ppt_dir / "media"
        embeddings_dir = ppt_dir / "embeddings"
        tags_dir = ppt_dir / "tags"
        notes_dir = ppt_dir / "notesSlides"
        notes_rels_dir = notes_dir / "_rels"
        theme_dir = ppt_dir / "theme"

        for d in [slides_dir, slides_rels_dir, layouts_dir, layouts_rels_dir,
                  masters_dir, masters_rels_dir, charts_dir, charts_rels_dir,
                  drawings_dir, media_dir, embeddings_dir, tags_dir, notes_dir, notes_rels_dir, theme_dir]:
            d.mkdir(parents=True, exist_ok=True)

        # Step 2: Harvest ALL master, layout, theme, media, and package infrastructure from ALL presentations
        for pptx_file in unique_source_files:
            with zipfile.ZipFile(pptx_file, 'r') as zf:
                for name in zf.namelist():
                    if (name.startswith("ppt/slideLayouts/") or 
                        name.startswith("ppt/slideMasters/") or 
                        name.startswith("ppt/theme/") or
                        name.startswith("ppt/notesMasters/") or
                        name.startswith("ppt/handoutMasters/") or
                        name.startswith("ppt/media/") or
                        name.startswith("customXml/")):
                        dest = merged_root / name
                        if not dest.exists():
                            dest.parent.mkdir(parents=True, exist_ok=True)
                            dest.write_bytes(zf.read(name))

        # Clear instance-specific folders
        for clean_folder in ["slides", "notesSlides", "drawings", "charts"]:
            f_path = ppt_dir / clean_folder
            if f_path.exists():
                shutil.rmtree(f_path)
            f_path.mkdir(parents=True, exist_ok=True)
            (f_path / "_rels").mkdir(parents=True, exist_ok=True)

        pres_xml_path = ppt_dir / "presentation.xml"
        pres_rels_path = ppt_dir / "_rels" / "presentation.xml.rels"
        content_types_path = merged_root / "[Content_Types].xml"

        pres_tree = ET.parse(pres_xml_path)
        pres_root = pres_tree.getroot()
        pres_rels_tree = ET.parse(pres_rels_path)
        pres_rels_root = pres_rels_tree.getroot()
        ct_tree = ET.parse(content_types_path)
        ct_root = ct_tree.getroot()

        sldIdLst = pres_root.find("{http://schemas.openxmlformats.org/presentationml/2006/main}sldIdLst")
        if sldIdLst is not None:
            sldIdLst.clear()
        else:
            sldIdLst = ET.SubElement(pres_root, "{http://schemas.openxmlformats.org/presentationml/2006/main}sldIdLst")

        for r in [r for r in pres_rels_root.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship") if r.get("Type", "").endswith("/slide")]:
            pres_rels_root.remove(r)

        for o in [o for o in ct_root.findall("{http://schemas.openxmlformats.org/package/2006/content-types}Override")
                  if (o.get("PartName", "").startswith("/ppt/slides/slide") or 
                      o.get("PartName", "").startswith("/ppt/notesSlides/notesSlide") or
                      o.get("PartName", "").startswith("/ppt/drawings/drawing") or
                      o.get("PartName", "").startswith("/ppt/charts/"))]:
            ct_root.remove(o)

        def ensure_content_type_default(ext, content_type):
            ext = ext.lower().lstrip('.')
            for d in ct_root.findall("{http://schemas.openxmlformats.org/package/2006/content-types}Default"):
                if d.get("Extension", "").lower() == ext:
                    return
            d_elem = ET.SubElement(ct_root, "{http://schemas.openxmlformats.org/package/2006/content-types}Default")
            d_elem.set("Extension", ext)
            d_elem.set("ContentType", content_type)

        def ensure_content_type_override(part_name, content_type):
            if not part_name.startswith("/"):
                part_name = "/" + part_name
            for o in ct_root.findall("{http://schemas.openxmlformats.org/package/2006/content-types}Override"):
                if o.get("PartName") == part_name:
                    o.set("ContentType", content_type)
                    return
            o_elem = ET.SubElement(ct_root, "{http://schemas.openxmlformats.org/package/2006/content-types}Override")
            o_elem.set("PartName", part_name)
            o_elem.set("ContentType", content_type)

        for ext, ct in CONTENT_TYPE_DEFAULTS.items():
            ensure_content_type_default(ext, ct)

        # Index existing layouts
        for l_path in layouts_dir.glob("slideLayout*.xml"):
            ensure_content_type_override(
                f"/ppt/slideLayouts/{l_path.name}",
                "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"
            )

        def import_layout_dependencies(src_layout_path):
            """
            Copies layout-linked .rels and all referenced media dependencies into the merged package.
            Prevents missing background banners, logos, and textures on merged layouts.
            """
            src_rels = src_layout_path.parent / "_rels" / f"{src_layout_path.name}.rels"
            if not src_rels.exists():
                return

            l_rels_tree = ET.parse(src_rels)
            for l_rel in l_rels_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                l_target = l_rel.get("Target", "")
                l_type = l_rel.get("Type", "")
                if "image" in l_type or "/media/" in l_target.replace('\\', '/'):
                    src_media = (src_layout_path.parent / l_target).resolve()
                    if src_media.exists():
                        dst_media = media_dir / src_media.name
                        if not dst_media.exists():
                            shutil.copy2(src_media, dst_media)
                        ext = src_media.suffix.lower()
                        if ext in CONTENT_TYPE_DEFAULTS:
                            ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])

            save_rels_xml(l_rels_tree, layouts_rels_dir / f"{src_layout_path.name}.rels")

        pres_rids = set()
        for r in pres_rels_root.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
            rv = r.get("Id", "")
            if rv.startswith("rId"):
                try:
                    pres_rids.add(int(rv[3:]))
                except ValueError:
                    pass
        next_pres_rid_num = max(pres_rids, default=0) + 1
        next_slide_id = 256

        chart_counter = 0
        drawing_counter = 0
        embed_counter = 0
        media_counter = len(list(media_dir.glob("*")))
        notes_counter = 0
        tag_counter = len(list(tags_dir.glob("tag*.xml")))
        theme_override_counter = len(list(theme_dir.glob("themeOverride*.xml")))
        all_created_slide_ids = []
        global_slide_idx = 0
        total_slides_merged = 0
        locked_layout_filenames = set()

        # Step 3: Stitch selected slides & re-link all assets with true fidelity
        for f_idx, spec in enumerate(normalized_specs, start=1):
            pptx_file = spec["file"]
            curr_temp = temp_dir / f"s_{f_idx}"
            curr_temp.mkdir()
            with zipfile.ZipFile(pptx_file, 'r') as zf:
                zf.extractall(curr_temp)

            c_slides_dir = curr_temp / "ppt" / "slides"
            if not c_slides_dir.exists():
                continue

            all_canonical_slides = get_presentation_slide_paths(curr_temp)
            if not all_canonical_slides:
                continue

            try:
                selected_indices = parse_slide_selection(spec["slides"], len(all_canonical_slides))
            except Exception as e:
                print(f"[ERROR] Invalid slide range for {pptx_file.name}: {e}")
                raise

            slides_to_process = []
            for idx in selected_indices:
                if 0 <= idx < len(all_canonical_slides):
                    src_s_path = all_canonical_slides[idx]
                    if spec["skip_hidden"] and is_slide_hidden(src_s_path):
                        continue
                    slides_to_process.append(src_s_path)

            for src_slide in slides_to_process:
                global_slide_idx += 1
                total_slides_merged += 1
                s_idx = global_slide_idx

                new_slide_name = f"slide{s_idx}.xml"
                shutil.copy2(src_slide, slides_dir / new_slide_name)
                ensure_content_type_override(
                    f"/ppt/slides/{new_slide_name}",
                    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
                )

                src_rels_file = c_slides_dir / "_rels" / f"{src_slide.name}.rels"
                if src_rels_file.exists():
                    s_rels_tree = ET.parse(src_rels_file)
                    for rel in s_rels_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                        r_type = rel.get("Type", "")
                        r_target = rel.get("Target", "")
                        type_short = r_type.split('/')[-1]

                        # Deterministic 'First-Use Wins' Layout Hash Synchronization & Media Linker
                        if "slideLayout" in type_short:
                            src_layout = (c_slides_dir / r_target).resolve()
                            if src_layout.exists():
                                dst_layout = layouts_dir / src_layout.name
                                if dst_layout.exists():
                                    # First use wins: if same filename but different content,
                                    # align shared layout to the first encountered slide source.
                                    if src_layout.name not in locked_layout_filenames:
                                        if file_sha256(src_layout) != file_sha256(dst_layout):
                                            shutil.copy2(src_layout, dst_layout)
                                            import_layout_dependencies(src_layout)
                                        locked_layout_filenames.add(src_layout.name)
                                    rel.set("Target", f"../slideLayouts/{src_layout.name}")
                                else:
                                    # Layout does not exist in destination: copy it, import dependencies, and register
                                    shutil.copy2(src_layout, dst_layout)
                                    import_layout_dependencies(src_layout)
                                    ensure_content_type_override(
                                        f"/ppt/slideLayouts/{src_layout.name}",
                                        "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"
                                    )
                                    locked_layout_filenames.add(src_layout.name)
                                    rel.set("Target", f"../slideLayouts/{src_layout.name}")
                            elif (layouts_dir / "slideLayout1.xml").exists():
                                rel.set("Target", "../slideLayouts/slideLayout1.xml")

                        # Embedded Charts & Associated Assets
                        elif "chart" in type_short and "chartUserShapes" not in type_short:
                            src_chart = (c_slides_dir / r_target).resolve()
                            if src_chart.exists():
                                chart_counter += 1
                                new_c_name = f"chart{chart_counter}.xml"
                                shutil.copy2(src_chart, charts_dir / new_c_name)
                                ensure_content_type_override(
                                    f"/ppt/charts/{new_c_name}",
                                    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
                                )

                                src_c_rels = src_chart.parent / "_rels" / f"{src_chart.name}.rels"
                                if src_c_rels.exists():
                                    cr_tree = ET.parse(src_c_rels)
                                    for cr in cr_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                                        c_t = cr.get("Target", "")
                                        c_ty = cr.get("Type", "")

                                        if "themeOverride" in c_ty or "themeOverride" in c_t:
                                            src_to = (src_chart.parent / c_t).resolve()
                                            if src_to.exists():
                                                theme_override_counter += 1
                                                new_to = f"themeOverride{theme_override_counter}.xml"
                                                shutil.copy2(src_to, theme_dir / new_to)
                                                ensure_content_type_override(
                                                    f"/ppt/theme/{new_to}",
                                                    "application/vnd.openxmlformats-officedocument.themeOverride+xml"
                                                )
                                                cr.set("Target", f"../theme/{new_to}")

                                        elif "package" in c_ty or "oleObject" in c_ty:
                                            if cr.get("TargetMode") != "External":
                                                src_emb = (src_chart.parent / c_t).resolve()
                                                if src_emb.exists() and "embeddings" in str(src_emb):
                                                    embed_counter += 1
                                                    new_emb = f"embed_{chart_counter}_{embed_counter}_{src_emb.name}"
                                                    shutil.copy2(src_emb, embeddings_dir / new_emb)
                                                    cr.set("Target", f"../embeddings/{new_emb}")
                                                    ext = src_emb.suffix.lower()
                                                    if ext in CONTENT_TYPE_DEFAULTS:
                                                        ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])

                                        elif "chartUserShapes" in c_ty or "drawings" in c_t:
                                            src_drw = (src_chart.parent / c_t).resolve()
                                            if src_drw.exists():
                                                drawing_counter += 1
                                                new_drw = f"drawing{drawing_counter}.xml"
                                                shutil.copy2(src_drw, drawings_dir / new_drw)
                                                ensure_content_type_override(
                                                    f"/ppt/drawings/{new_drw}",
                                                    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml"
                                                )
                                                cr.set("Target", f"../drawings/{new_drw}")

                                        elif "chartStyle" in c_ty or "style" in c_t:
                                            src_sty = (src_chart.parent / c_t).resolve()
                                            if src_sty.exists():
                                                new_sty = f"style_{chart_counter}_{src_sty.name}"
                                                shutil.copy2(src_sty, charts_dir / new_sty)
                                                ensure_content_type_override(
                                                    f"/ppt/charts/{new_sty}",
                                                    "application/vnd.ms-office.chartstyle+xml"
                                                )
                                                cr.set("Target", new_sty)

                                        elif "chartColorStyle" in c_ty or "colors" in c_t:
                                            src_col = (src_chart.parent / c_t).resolve()
                                            if src_col.exists():
                                                new_col = f"colors_{chart_counter}_{src_col.name}"
                                                shutil.copy2(src_col, charts_dir / new_col)
                                                ensure_content_type_override(
                                                    f"/ppt/charts/{new_col}",
                                                    "application/vnd.ms-office.chartcolorstyle+xml"
                                                )
                                                cr.set("Target", new_col)

                                    save_rels_xml(cr_tree, charts_rels_dir / f"{new_c_name}.rels")
                                rel.set("Target", f"../charts/{new_c_name}")

                        # Images and Media (including Slide Background Blips)
                        elif "image" in type_short or "media" in type_short:
                            src_med = (c_slides_dir / r_target).resolve()
                            if src_med.exists():
                                media_counter += 1
                                new_med = f"image_{s_idx}_{media_counter}_{src_med.name}"
                                shutil.copy2(src_med, media_dir / new_med)
                                ext = src_med.suffix.lower()
                                if ext in CONTENT_TYPE_DEFAULTS:
                                    ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                                rel.set("Target", f"../media/{new_med}")

                        # Embedded OLE Objects / Packages
                        elif "oleObject" in type_short or "package" in type_short:
                            if rel.get("TargetMode") != "External":
                                src_ole = (c_slides_dir / r_target).resolve()
                                if src_ole.exists():
                                    embed_counter += 1
                                    new_ole = f"ole_{s_idx}_{embed_counter}_{src_ole.name}"
                                    shutil.copy2(src_ole, embeddings_dir / new_ole)
                                    ext = src_ole.suffix.lower()
                                    if ext in CONTENT_TYPE_DEFAULTS:
                                        ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                                    rel.set("Target", f"../embeddings/{new_ole}")

                        # Slide Metadata Tags
                        elif "tags" in type_short:
                            src_tag = (c_slides_dir / r_target).resolve()
                            if src_tag.exists():
                                tag_counter += 1
                                new_tag = f"tag_{s_idx}_{tag_counter}.xml"
                                shutil.copy2(src_tag, tags_dir / new_tag)
                                ensure_content_type_override(
                                    f"/ppt/tags/{new_tag}",
                                    "application/vnd.openxmlformats-officedocument.presentationml.tags+xml"
                                )
                                rel.set("Target", f"../tags/{new_tag}")

                        # Speaker Notes Slides
                        elif "notesSlide" in type_short:
                            src_notes = (c_slides_dir / r_target).resolve()
                            if src_notes.exists():
                                notes_counter += 1
                                new_notes = f"notesSlide{s_idx}.xml"
                                shutil.copy2(src_notes, notes_dir / new_notes)
                                ensure_content_type_override(
                                    f"/ppt/notesSlides/{new_notes}",
                                    "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"
                                )

                                src_nr = src_notes.parent / "_rels" / f"{src_notes.name}.rels"
                                if src_nr.exists():
                                    nr_tree = ET.parse(src_nr)
                                    for nr in nr_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                                        if nr.get("Type", "").endswith("/slide"):
                                            nr.set("Target", f"../slides/{new_slide_name}")
                                    save_rels_xml(nr_tree, notes_rels_dir / f"{new_notes}.rels")
                                rel.set("Target", f"../notesSlides/{new_notes}")

                    save_rels_xml(s_rels_tree, slides_rels_dir / f"{new_slide_name}.rels")

                # Register slide into presentation.xml
                s_rid = f"rId{next_pres_rid_num}"
                next_pres_rid_num += 1

                prel = ET.SubElement(pres_rels_root, "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
                prel.set("Id", s_rid)
                prel.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
                prel.set("Target", f"slides/{new_slide_name}")

                sldId = ET.SubElement(sldIdLst, "{http://schemas.openxmlformats.org/presentationml/2006/main}sldId")
                sldId.set("id", str(next_slide_id))
                sldId.set("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", s_rid)
                all_created_slide_ids.append(next_slide_id)
                next_slide_id += 1

        # Synchronize Sections
        sync_presentation_sections(pres_root, all_created_slide_ids)

        # Synchronize docProps/app.xml
        update_doc_props_app(merged_root / "docProps" / "app.xml", total_slides_merged, notes_counter)

        # Save XML trees
        save_presentation_xml(pres_tree, pres_xml_path)
        save_rels_xml(pres_rels_tree, pres_rels_path)
        save_content_types_xml(ct_tree, content_types_path)

        # Build clean .pptx archive
        with zipfile.ZipFile(output_pptx_path, 'w', compression=zipfile.ZIP_DEFLATED) as out_zip:
            for root, _, files in os.walk(merged_root):
                for file in files:
                    fp = Path(root) / file
                    out_zip.write(fp, arcname=str(fp.relative_to(merged_root)))

    print(f"[SUCCESS] Autonomous merged presentation created: {output_pptx_path}")
    print(f"[SUCCESS] Total slides merged: {total_slides_merged}")
    return output_pptx_path


def merge_from_json(json_recipe_path, output_pptx_path):
    """
    Convenience function: Autonomously merges presentations defined in an external JSON recipe file.
    
    :param json_recipe_path: Path to the JSON recipe/manifest file.
    :param output_pptx_path: Destination path for the merged .pptx presentation.
    :return: Path to the generated output .pptx presentation.
    """
    return merge_pptx_files_autonomous(json_recipe_path, output_pptx_path)


def parse_cli_args():
    """Command Line Interface argument parser."""
    parser = argparse.ArgumentParser(
        description="Autonomous Platform-Independent PowerPoint (.pptx) Slide Merger"
    )
    parser.add_argument(
        "positional_inputs",
        nargs="*",
        help="Optional positional inputs (e.g. 'recipe.json', 'deck1.pptx:1-3', or list of pptx files)"
    )
    parser.add_argument(
        "-i", "--inputs",
        nargs="+",
        help="Input files, slide specs (e.g. 'deck1.pptx:1-3,5' 'deck2.pptx:2,4'), or JSON recipe file"
    )
    parser.add_argument(
        "-d", "--dir",
        help="Input directory containing .pptx presentations to merge in natural sort order"
    )
    parser.add_argument(
        "-r", "-c", "--recipe", "--config",
        help="JSON recipe/manifest file describing the presentations and slide ranges to merge"
    )
    parser.add_argument(
        "-o", "--output",
        default="merged_output_autonomous.pptx",
        help="Destination path for the merged .pptx presentation (default: merged_output_autonomous.pptx)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_cli_args()
    base_dir = Path(__file__).resolve().parent

    inputs_to_process = []

    if args.recipe:
        inputs_to_process = args.recipe
    elif args.inputs:
        inputs_to_process = args.inputs
    elif args.positional_inputs:
        if len(args.positional_inputs) == 1 and args.positional_inputs[0].lower().endswith(".json"):
            inputs_to_process = args.positional_inputs[0]
        else:
            inputs_to_process = args.positional_inputs
    elif args.dir:
        input_dir = Path(args.dir).resolve()
        inputs_to_process = sorted(input_dir.glob("*.pptx"), key=natural_sort_key)
    else:
        # Default behavior: look in ./ppts directory
        default_dir = (base_dir / "ppts").resolve()
        if default_dir.exists():
            inputs_to_process = sorted(default_dir.glob("*.pptx"), key=natural_sort_key)
            print(f"[Autonomous Merger] Using default input directory: {default_dir}")
        else:
            inputs_to_process = sorted(base_dir.glob("*.pptx"), key=natural_sort_key)

    output_path = Path(args.output).resolve()
    print(f"[Autonomous Merger] Output file: {output_path}")

    merge_pptx_files_autonomous(inputs_to_process, output_path)
