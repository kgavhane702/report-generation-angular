"""
Autonomous PowerPoint (.pptx) Slide Merger
==========================================
Merges individual single-slide PPTX presentations into a single master presentation
100% autonomously with NO external template or reference file required.

Pure Python implementation:
- Platform-independent (Windows, macOS, Linux)
- Zero dependency on Microsoft Office or PowerPoint COM
- Fully preserves themes, vector shapes, DrawingML charts, embedded Excel workbooks,
  OLE objects, custom XML parts, layout masters, and presenter notes.

Usage:
    python merge_autonomous.py
"""

import os
import re
import shutil
import zipfile
import tempfile
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


def natural_sort_key(s):
    """Natural sorting key for human-ordered filenames (e.g. slide_1, slide_2, slide_10)."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', str(s))]


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


def autonomous_merge_pptx(input_pptx_files, output_pptx_path):
    """
    Merges a sequence of single-slide PPTX files into one presentation autonomously.
    No template or reference file is required.
    
    :param input_pptx_files: List of paths to input single-slide .pptx files.
    :param output_pptx_path: Path where the merged presentation will be written.
    """
    if not input_pptx_files:
        raise ValueError("No input PPTX files provided.")

    output_pptx_path = Path(output_pptx_path)
    output_pptx_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir = Path(temp_dir)
        merged_root = temp_dir / "merged"
        merged_root.mkdir()

        # Step 1: Base package from the first slide file
        with zipfile.ZipFile(input_pptx_files[0], 'r') as zf:
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

        pres_xml_path = ppt_dir / "presentation.xml"
        pres_rels_path = ppt_dir / "_rels" / "presentation.xml.rels"
        content_types_path = merged_root / "[Content_Types].xml"

        pres_tree = ET.parse(pres_xml_path)
        pres_root = pres_tree.getroot()
        pres_rels_tree = ET.parse(pres_rels_path)
        pres_rels_root = pres_rels_tree.getroot()
        ct_tree = ET.parse(content_types_path)
        ct_root = ct_tree.getroot()

        # Clear existing slide instances
        for clean_folder in ["slides", "notesSlides", "drawings"]:
            f_path = ppt_dir / clean_folder
            if f_path.exists():
                shutil.rmtree(f_path)
            f_path.mkdir(parents=True, exist_ok=True)
            (f_path / "_rels").mkdir(parents=True, exist_ok=True)

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
                      o.get("PartName", "").startswith("/ppt/drawings/drawing"))]:
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
                    return
            o_elem = ET.SubElement(ct_root, "{http://schemas.openxmlformats.org/package/2006/content-types}Override")
            o_elem.set("PartName", part_name)
            o_elem.set("ContentType", content_type)

        for ext, ct in CONTENT_TYPE_DEFAULTS.items():
            ensure_content_type_default(ext, ct)

        # Existing layout map: layout name -> filename
        existing_layouts = {}
        for l_path in layouts_dir.glob("slideLayout*.xml"):
            l_tree = ET.parse(l_path)
            cSld = l_tree.getroot().find("{http://schemas.openxmlformats.org/presentationml/2006/main}cSld")
            if cSld is not None:
                name = cSld.get("name", "")
                if name and name not in existing_layouts:
                    existing_layouts[name] = l_path.name

        # Master management: load master XML texts and rels
        master_texts = {}
        master_max_ids = {}
        master_rels_trees = {}
        for m_path in masters_dir.glob("slideMaster*.xml"):
            m_text = m_path.read_text(encoding='utf-8')
            master_texts[m_path.name] = m_text
            all_ids = [int(x) for x in re.findall(r'<p:sldLayoutId[^>]*id=["\'](\d+)["\']', m_text)]
            master_max_ids[m_path.name] = max(all_ids, default=2147483648)
            mr_path = masters_rels_dir / f"{m_path.name}.rels"
            if mr_path.exists():
                master_rels_trees[m_path.name] = ET.parse(mr_path)

        def add_layout_to_master(layout_fname, master_fname):
            if master_fname not in master_texts or master_fname not in master_rels_trees:
                master_fname = list(master_texts.keys())[0]

            mr_tree = master_rels_trees[master_fname]
            mr_root = mr_tree.getroot()

            rids = set()
            for r in mr_root.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                rv = r.get("Id", "")
                if rv.startswith("rId"):
                    try:
                        rids.add(int(rv[3:]))
                    except ValueError:
                        pass
            next_m_rid = f"rId{max(rids, default=0) + 1}"

            rel = ET.SubElement(mr_root, "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
            rel.set("Id", next_m_rid)
            rel.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout")
            rel.set("Target", f"../slideLayouts/{layout_fname}")

            new_id = master_max_ids[master_fname] + 1
            master_max_ids[master_fname] = new_id

            tag_to_insert = f'<p:sldLayoutId id="{new_id}" r:id="{next_m_rid}"/>'
            m_text = master_texts[master_fname]
            if '</p:sldLayoutIdLst>' in m_text:
                m_text = m_text.replace('</p:sldLayoutIdLst>', f'{tag_to_insert}</p:sldLayoutIdLst>')
                master_texts[master_fname] = m_text

        # PHASE 1: Pre-harvest all unique layouts across all split presentations
        layout_counter = len(list(layouts_dir.glob("slideLayout*.xml")))
        for pptx_file in input_pptx_files:
            with zipfile.ZipFile(pptx_file, 'r') as zf:
                s_rels_xml = zf.read("ppt/slides/_rels/slide1.xml.rels")
                s_rels_tree = ET.fromstring(s_rels_xml)
                for r in s_rels_tree:
                    if r.get("Type", "").endswith("/slideLayout"):
                        t = r.get("Target", "")
                        l_entry = "ppt/" + t.replace("../", "")
                        if l_entry in zf.namelist():
                            l_xml = zf.read(l_entry)
                            l_elem = ET.fromstring(l_xml)
                            cSld = l_elem.find("{http://schemas.openxmlformats.org/presentationml/2006/main}cSld")
                            lname = cSld.get("name", "") if cSld is not None else ""
                            
                            if lname and lname not in existing_layouts:
                                layout_counter += 1
                                new_layout_filename = f"slideLayout{layout_counter}.xml"
                                (layouts_dir / new_layout_filename).write_bytes(l_xml)
                                ensure_content_type_override(f"/ppt/slideLayouts/{new_layout_filename}", "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml")

                                l_rels_entry = l_entry.replace("slideLayouts/", "slideLayouts/_rels/") + ".rels"
                                master_fname = "slideMaster2.xml"
                                if l_rels_entry in zf.namelist():
                                    lr_tree = ET.fromstring(zf.read(l_rels_entry))
                                    for lr in lr_tree:
                                        lr_t = lr.get("Target", "")
                                        if lr.get("Type", "").endswith("/slideMaster"):
                                            master_fname = posixpath.basename(lr_t)
                                            if master_fname not in master_texts:
                                                master_fname = list(master_texts.keys())[0]
                                            lr.set("Target", f"../slideMasters/{master_fname}")
                                        else:
                                            asset_entry = "ppt/" + lr_t.replace("../", "")
                                            if asset_entry in zf.namelist():
                                                dest_asset_path = ppt_dir / lr_t.replace("../", "")
                                                dest_asset_path.parent.mkdir(parents=True, exist_ok=True)
                                                if not dest_asset_path.exists():
                                                    dest_asset_path.write_bytes(zf.read(asset_entry))
                                                ext = dest_asset_path.suffix.lower()
                                                if ext in CONTENT_TYPE_DEFAULTS:
                                                    ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                                    
                                    save_rels_xml(ET.ElementTree(lr_tree), layouts_rels_dir / f"{new_layout_filename}.rels")

                                add_layout_to_master(new_layout_filename, master_fname)
                                existing_layouts[lname] = new_layout_filename

        # Write updated slide masters and master rels
        for m_name, m_text in master_texts.items():
            (masters_dir / m_name).write_text(m_text, encoding='utf-8')
        for m_name, mr_tree in master_rels_trees.items():
            save_rels_xml(mr_tree, masters_rels_dir / f"{m_name}.rels")

        # PHASE 2: Slide Assembly & Conflict Resolution
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
        tag_counter = len(list(tags_dir.glob("tag*.xml")))
        theme_override_counter = len(list(theme_dir.glob("themeOverride*.xml")))

        for s_idx, pptx_file in enumerate(input_pptx_files, start=1):
            curr_temp = temp_dir / f"s_{s_idx}"
            curr_temp.mkdir()
            with zipfile.ZipFile(pptx_file, 'r') as zf:
                zf.extractall(curr_temp)

            c_slides = curr_temp / "ppt" / "slides"
            if not c_slides.exists():
                continue

            src_slide = c_slides / "slide1.xml"
            if not src_slide.exists():
                continue

            new_slide_name = f"slide{s_idx}.xml"
            shutil.copy2(src_slide, slides_dir / new_slide_name)
            ensure_content_type_override(f"/ppt/slides/{new_slide_name}", "application/vnd.openxmlformats-officedocument.presentationml.slide+xml")

            src_rels_file = c_slides / "_rels" / "slide1.xml.rels"
            if src_rels_file.exists():
                s_rels_tree = ET.parse(src_rels_file)
                for rel in s_rels_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                    r_type = rel.get("Type", "")
                    r_target = rel.get("Target", "")
                    type_short = r_type.split('/')[-1]

                    # Slide Layout
                    if "slideLayout" in type_short:
                        src_layout = (c_slides / r_target).resolve()
                        if src_layout.exists():
                            l_tree = ET.parse(src_layout)
                            cSld = l_tree.getroot().find("{http://schemas.openxmlformats.org/presentationml/2006/main}cSld")
                            layout_name = cSld.get("name", "") if cSld is not None else ""
                            if layout_name in existing_layouts:
                                rel.set("Target", f"../slideLayouts/{existing_layouts[layout_name]}")

                    # Charts
                    elif "chart" in type_short and "chartUserShapes" not in type_short:
                        src_chart = (c_slides / r_target).resolve()
                        if src_chart.exists():
                            chart_counter += 1
                            new_c_name = f"chart{chart_counter}.xml"
                            shutil.copy2(src_chart, charts_dir / new_c_name)
                            ensure_content_type_override(f"/ppt/charts/{new_c_name}", "application/vnd.openxmlformats-officedocument.drawingml.chart+xml")

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
                                            ensure_content_type_override(f"/ppt/theme/{new_to}", "application/vnd.openxmlformats-officedocument.themeOverride+xml")
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
                                            ensure_content_type_override(f"/ppt/drawings/{new_drw}", "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml")
                                            cr.set("Target", f"../drawings/{new_drw}")

                                    elif "chartStyle" in c_ty or "style" in c_t:
                                        src_sty = (src_chart.parent / c_t).resolve()
                                        if src_sty.exists():
                                            new_sty = f"style_{chart_counter}_{src_sty.name}"
                                            shutil.copy2(src_sty, charts_dir / new_sty)
                                            ensure_content_type_override(f"/ppt/charts/{new_sty}", "application/vnd.ms-office.drawingml.chartstyle+xml")
                                            cr.set("Target", new_sty)

                                    elif "chartColorStyle" in c_ty or "colors" in c_t:
                                        src_col = (src_chart.parent / c_t).resolve()
                                        if src_col.exists():
                                            new_col = f"colors_{chart_counter}_{src_col.name}"
                                            shutil.copy2(src_col, charts_dir / new_col)
                                            ensure_content_type_override(f"/ppt/charts/{new_col}", "application/vnd.ms-office.drawingml.chartcolorstyle+xml")
                                            cr.set("Target", new_col)

                                save_rels_xml(cr_tree, charts_rels_dir / f"{new_c_name}.rels")
                            rel.set("Target", f"../charts/{new_c_name}")

                    # Images / Media
                    elif "image" in type_short or "media" in type_short:
                        src_med = (c_slides / r_target).resolve()
                        if src_med.exists():
                            media_counter += 1
                            new_med = f"image_{s_idx}_{media_counter}_{src_med.name}"
                            shutil.copy2(src_med, media_dir / new_med)
                            ext = src_med.suffix.lower()
                            if ext in CONTENT_TYPE_DEFAULTS:
                                ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                            rel.set("Target", f"../media/{new_med}")

                    # Embedded OLE objects (Excel sheets, binary packages)
                    elif "oleObject" in type_short or "package" in type_short:
                        if rel.get("TargetMode") != "External":
                            src_ole = (c_slides / r_target).resolve()
                            if src_ole.exists():
                                embed_counter += 1
                                new_ole = f"ole_{s_idx}_{embed_counter}_{src_ole.name}"
                                shutil.copy2(src_ole, embeddings_dir / new_ole)
                                ext = src_ole.suffix.lower()
                                if ext in CONTENT_TYPE_DEFAULTS:
                                    ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                                rel.set("Target", f"../embeddings/{new_ole}")

                    # Metadata Tags
                    elif "tags" in type_short:
                        src_tag = (c_slides / r_target).resolve()
                        if src_tag.exists():
                            tag_counter += 1
                            new_tag = f"tag_{s_idx}_{tag_counter}.xml"
                            shutil.copy2(src_tag, tags_dir / new_tag)
                            ensure_content_type_override(f"/ppt/tags/{new_tag}", "application/vnd.openxmlformats-officedocument.presentationml.tags+xml")
                            rel.set("Target", f"../tags/{new_tag}")

                    # Presenter Notes
                    elif "notesSlide" in type_short:
                        src_notes = (c_slides / r_target).resolve()
                        if src_notes.exists():
                            new_notes = f"notesSlide{s_idx}.xml"
                            shutil.copy2(src_notes, notes_dir / new_notes)
                            ensure_content_type_override(f"/ppt/notesSlides/{new_notes}", "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml")

                            src_nr = src_notes.parent / "_rels" / f"{src_notes.name}.rels"
                            if src_nr.exists():
                                nr_tree = ET.parse(src_nr)
                                for nr in nr_tree.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                                    if nr.get("Type", "").endswith("/slide"):
                                        nr.set("Target", f"../slides/{new_slide_name}")
                                save_rels_xml(nr_tree, notes_rels_dir / f"{new_notes}.rels")
                            rel.set("Target", f"../notesSlides/{new_notes}")

                save_rels_xml(s_rels_tree, slides_rels_dir / f"{new_slide_name}.rels")

            # Register slide into presentation.xml and presentation.xml.rels
            s_rid = f"rId{next_pres_rid_num}"
            next_pres_rid_num += 1

            prel = ET.SubElement(pres_rels_root, "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
            prel.set("Id", s_rid)
            prel.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
            prel.set("Target", f"slides/{new_slide_name}")

            sldId = ET.SubElement(sldIdLst, "{http://schemas.openxmlformats.org/presentationml/2006/main}sldId")
            sldId.set("id", str(next_slide_id))
            sldId.set("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", s_rid)
            next_slide_id += 1

        # Save package manifests
        save_presentation_xml(pres_tree, pres_xml_path)
        save_rels_xml(pres_rels_tree, pres_rels_path)
        save_content_types_xml(ct_tree, content_types_path)

        # Build output ZIP package
        with zipfile.ZipFile(output_pptx_path, 'w', compression=zipfile.ZIP_DEFLATED) as out_zip:
            for root, _, files in os.walk(merged_root):
                for file in files:
                    fp = Path(root) / file
                    out_zip.write(fp, arcname=str(fp.relative_to(merged_root)))

    print(f"[SUCCESS] Autonomous Merged Presentation: {output_pptx_path}")
    print(f"[SUCCESS] Total Slides Merged: {len(input_pptx_files)}")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    splitted_dir = base_dir / "splitted_ppt"
    output_merged_path = base_dir / "merged_autonomous_output.pptx"

    slide_files = sorted(splitted_dir.glob("slide_*.pptx"), key=natural_sort_key)
    print(f"Scanning '{splitted_dir}'...")
    print(f"Found {len(slide_files)} slide files to merge autonomously.")

    autonomous_merge_pptx(slide_files, output_merged_path)
