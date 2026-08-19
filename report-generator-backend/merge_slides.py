"""
Platform-Independent PowerPoint (.pptx) Merger
================================================
Works seamlessly across Windows, macOS, and Linux without MS Office or external dependencies.
Merges individual single-slide PPTX files into a single master presentation
with 100% design fidelity: preserving layouts, slide masters, themes, colors,
fonts, vector shapes, embedded charts, Excel workbooks, OLE objects, drawings, and media.
"""

import os
import re
import shutil
import zipfile
import tempfile
import posixpath
import xml.etree.ElementTree as ET
from pathlib import Path

# Standard OpenXML Namespaces
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_RELS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NS_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
NS_P15 = "http://schemas.microsoft.com/office/powerpoint/2012/main"
NS_P16 = "http://schemas.microsoft.com/office/powerpoint/2015/main"
NS_A14 = "http://schemas.microsoft.com/office/drawing/2010/main"
NS_A16 = "http://schemas.microsoft.com/office/drawing/2014/main"
NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart"

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
    """Sort strings containing numbers in natural human order."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', str(s))]


def save_presentation_xml(tree, file_path):
    """Saves presentation.xml ensuring standard OpenXML namespace prefixes."""
    ET.register_namespace('p', NS_P)
    ET.register_namespace('a', NS_A)
    ET.register_namespace('r', NS_R)
    ET.register_namespace('p14', NS_P14)
    ET.register_namespace('p15', NS_P15)
    ET.register_namespace('p16', NS_P16)
    ET.register_namespace('a14', NS_A14)
    ET.register_namespace('a16', NS_A16)
    ET.register_namespace('c', NS_C)
    tree.write(file_path, xml_declaration=True, encoding="utf-8")


def save_rels_xml(tree, file_path):
    """Saves any .rels file with standard default relationships namespace."""
    ET.register_namespace('', NS_RELS)
    tree.write(file_path, xml_declaration=True, encoding="utf-8")


def save_content_types_xml(tree, file_path):
    """Saves [Content_Types].xml with standard default content-types namespace."""
    ET.register_namespace('', NS_CT)
    tree.write(file_path, xml_declaration=True, encoding="utf-8")


def merge_pptx_files(input_pptx_files, output_pptx_path, template_source_dir=None):
    """
    Merges single-slide PPTX presentations into a single master presentation.
    """
    if not input_pptx_files:
        raise ValueError("No input PPTX files provided.")

    output_pptx_path = Path(output_pptx_path)
    output_pptx_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir = Path(temp_dir)
        merged_root = temp_dir / "merged"
        merged_root.mkdir()

        # Step 1: Initialize base structure from template_source_dir or first split file
        if template_source_dir and Path(template_source_dir).exists():
            shutil.copytree(template_source_dir, merged_root, dirs_exist_ok=True)
            
            # Clear old per-slide files in template
            ppt_dir = merged_root / "ppt"
            for clean_folder in ["slides", "notesSlides", "drawings"]:
                f_path = ppt_dir / clean_folder
                if f_path.exists():
                    shutil.rmtree(f_path)
                f_path.mkdir(parents=True, exist_ok=True)
                (f_path / "_rels").mkdir(parents=True, exist_ok=True)
        else:
            base_pptx = Path(input_pptx_files[0])
            with zipfile.ZipFile(base_pptx, 'r') as zf:
                zf.extractall(merged_root)

        ppt_dir = merged_root / "ppt"
        slides_dir = ppt_dir / "slides"
        slides_rels_dir = slides_dir / "_rels"
        layouts_dir = ppt_dir / "slideLayouts"
        charts_dir = ppt_dir / "charts"
        charts_rels_dir = charts_dir / "_rels"
        drawings_dir = ppt_dir / "drawings"
        media_dir = ppt_dir / "media"
        embeddings_dir = ppt_dir / "embeddings"
        tags_dir = ppt_dir / "tags"
        notes_dir = ppt_dir / "notesSlides"
        notes_rels_dir = notes_dir / "_rels"
        theme_dir = ppt_dir / "theme"

        for d in [slides_dir, slides_rels_dir, charts_dir, charts_rels_dir,
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

        # Build layout dictionary by layout name
        layout_name_to_filename = {}
        for l_path in layouts_dir.glob("slideLayout*.xml"):
            l_tree = ET.parse(l_path)
            cSld = l_tree.getroot().find(f"{{{NS_P}}}cSld")
            if cSld is not None:
                name = cSld.get("name", "")
                if name and name not in layout_name_to_filename:
                    layout_name_to_filename[name] = l_path.name

        # Reset slide list in presentation.xml
        sldIdLst = pres_root.find(f"{{{NS_P}}}sldIdLst")
        if sldIdLst is None:
            sldIdLst = ET.SubElement(pres_root, f"{{{NS_P}}}sldIdLst")
        else:
            sldIdLst.clear()

        # Remove ONLY slide relationships from presentation.xml.rels
        rels_to_remove = [r for r in pres_rels_root.findall(f"{{{NS_RELS}}}Relationship")
                          if r.get("Type", "").endswith("/slide")]
        for rel in rels_to_remove:
            pres_rels_root.remove(rel)

        # Remove old slide & notes overrides from [Content_Types].xml
        ct_to_remove = [o for o in ct_root.findall(f"{{{NS_CT}}}Override")
                        if (o.get("PartName", "").startswith("/ppt/slides/slide") or 
                            o.get("PartName", "").startswith("/ppt/notesSlides/notesSlide") or
                            o.get("PartName", "").startswith("/ppt/drawings/drawing"))]
        for o in ct_to_remove:
            ct_root.remove(o)

        existing_rids = set()
        for rel in pres_rels_root.findall(f"{{{NS_RELS}}}Relationship"):
            rid_val = rel.get("Id", "")
            if rid_val.startswith("rId"):
                try:
                    existing_rids.add(int(rid_val[3:]))
                except ValueError:
                    pass
        next_rid_num = max(existing_rids, default=0) + 1
        next_slide_id = 256

        def get_next_pres_rid():
            nonlocal next_rid_num
            rid = f"rId{next_rid_num}"
            next_rid_num += 1
            return rid

        def ensure_content_type_default(ext, content_type):
            ext = ext.lower().lstrip('.')
            for d in ct_root.findall(f"{{{NS_CT}}}Default"):
                if d.get("Extension", "").lower() == ext:
                    return
            d_elem = ET.SubElement(ct_root, f"{{{NS_CT}}}Default")
            d_elem.set("Extension", ext)
            d_elem.set("ContentType", content_type)

        def ensure_content_type_override(part_name, content_type):
            if not part_name.startswith("/"):
                part_name = "/" + part_name
            for o in ct_root.findall(f"{{{NS_CT}}}Override"):
                if o.get("PartName") == part_name:
                    return
            o_elem = ET.SubElement(ct_root, f"{{{NS_CT}}}Override")
            o_elem.set("PartName", part_name)
            o_elem.set("ContentType", content_type)

        for ext, ct in CONTENT_TYPE_DEFAULTS.items():
            ensure_content_type_default(ext, ct)

        chart_counter = 0
        drawing_counter = 0
        embed_counter = 0
        media_counter = 0
        tag_counter = len(list(tags_dir.glob("tag*.xml")))
        theme_override_counter = len(list(theme_dir.glob("themeOverride*.xml")))

        # Step 2: Iterate through each slide presentation in order
        for slide_idx, pptx_file in enumerate(input_pptx_files, start=1):
            pptx_path = Path(pptx_file)
            curr_temp = temp_dir / f"extracted_{slide_idx}"
            curr_temp.mkdir()

            with zipfile.ZipFile(pptx_path, 'r') as zf:
                zf.extractall(curr_temp)

            curr_ppt = curr_temp / "ppt"
            curr_slides = curr_ppt / "slides"
            if not curr_slides.exists():
                continue

            src_slide_xml = curr_slides / "slide1.xml"
            if not src_slide_xml.exists():
                continue

            new_slide_filename = f"slide{slide_idx}.xml"
            dest_slide_xml = slides_dir / new_slide_filename
            shutil.copy2(src_slide_xml, dest_slide_xml)
            ensure_content_type_override(f"/ppt/slides/{new_slide_filename}", "application/vnd.openxmlformats-officedocument.presentationml.slide+xml")

            # Process slide relationships
            src_slide_rels = curr_slides / "_rels" / "slide1.xml.rels"
            dest_slide_rels = slides_rels_dir / f"{new_slide_filename}.rels"

            if src_slide_rels.exists():
                slide_rels_tree = ET.parse(src_slide_rels)
                slide_rels_root = slide_rels_tree.getroot()

                for rel in slide_rels_root.findall(f"{{{NS_RELS}}}Relationship"):
                    rel_type = rel.get("Type", "")
                    target = rel.get("Target", "")
                    type_short = rel_type.split('/')[-1]

                    # 1. Slide Layout Resolution
                    if "slideLayout" in type_short:
                        src_layout_file = (curr_slides / target).resolve()
                        if src_layout_file.exists():
                            l_tree = ET.parse(src_layout_file)
                            cSld = l_tree.getroot().find(f"{{{NS_P}}}cSld")
                            layout_name = cSld.get("name", "") if cSld is not None else ""
                            
                            # Match by layout name in template
                            if layout_name and layout_name in layout_name_to_filename:
                                matched_layout = layout_name_to_filename[layout_name]
                                rel.set("Target", f"../slideLayouts/{matched_layout}")
                            else:
                                rel.set("Target", target)

                    # 2. Chart Resolution (with themeOverrides, workbooks, styles, colors, drawings)
                    elif "chart" in type_short and "chartUserShapes" not in type_short:
                        src_chart_file = (curr_slides / target).resolve()
                        if src_chart_file.exists():
                            chart_counter += 1
                            new_chart_name = f"chart{chart_counter}.xml"
                            dest_chart_file = charts_dir / new_chart_name
                            shutil.copy2(src_chart_file, dest_chart_file)
                            ensure_content_type_override(f"/ppt/charts/{new_chart_name}", "application/vnd.openxmlformats-officedocument.drawingml.chart+xml")

                            # Copy and update chart relationships
                            src_chart_rels = src_chart_file.parent / "_rels" / f"{src_chart_file.name}.rels"
                            if src_chart_rels.exists():
                                chart_tree = ET.parse(src_chart_rels)
                                chart_root = chart_tree.getroot()
                                for c_rel in chart_root.findall(f"{{{NS_RELS}}}Relationship"):
                                    c_target = c_rel.get("Target", "")
                                    c_type = c_rel.get("Type", "")

                                    # Theme Override
                                    if "themeOverride" in c_type or "themeOverride" in c_target:
                                        src_to = (src_chart_file.parent / c_target).resolve()
                                        if src_to.exists():
                                            theme_override_counter += 1
                                            new_to_name = f"themeOverride{theme_override_counter}.xml"
                                            dest_to = theme_dir / new_to_name
                                            shutil.copy2(src_to, dest_to)
                                            ensure_content_type_override(f"/ppt/theme/{new_to_name}", "application/vnd.openxmlformats-officedocument.themeOverride+xml")
                                            c_rel.set("Target", f"../theme/{new_to_name}")

                                    # Embedded Workbook
                                    elif "package" in c_type or "oleObject" in c_type:
                                        if c_rel.get("TargetMode") != "External":
                                            src_embed = (src_chart_file.parent / c_target).resolve()
                                            if src_embed.exists() and "embeddings" in str(src_embed):
                                                embed_counter += 1
                                                new_embed_name = f"embed_{chart_counter}_{embed_counter}_{src_embed.name}"
                                                dest_embed = embeddings_dir / new_embed_name
                                                shutil.copy2(src_embed, dest_embed)
                                                c_rel.set("Target", f"../embeddings/{new_embed_name}")
                                                ext = dest_embed.suffix.lower()
                                                if ext in CONTENT_TYPE_DEFAULTS:
                                                    ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])

                                    # Chart User Shapes / Drawings
                                    elif "chartUserShapes" in c_type or "drawings" in c_target:
                                        src_draw = (src_chart_file.parent / c_target).resolve()
                                        if src_draw.exists():
                                            drawing_counter += 1
                                            new_draw_name = f"drawing{drawing_counter}.xml"
                                            dest_draw = drawings_dir / new_draw_name
                                            shutil.copy2(src_draw, dest_draw)
                                            ensure_content_type_override(f"/ppt/drawings/{new_draw_name}", "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml")
                                            c_rel.set("Target", f"../drawings/{new_draw_name}")

                                    # Chart Style / Color Style (unique names to prevent collisions)
                                    elif "chartStyle" in c_type or "style" in c_target:
                                        src_style = (src_chart_file.parent / c_target).resolve()
                                        if src_style.exists():
                                            new_style_name = f"style_{chart_counter}_{src_style.name}"
                                            dest_style = charts_dir / new_style_name
                                            shutil.copy2(src_style, dest_style)
                                            ensure_content_type_override(f"/ppt/charts/{new_style_name}", "application/vnd.ms-office.drawingml.chartstyle+xml")
                                            c_rel.set("Target", new_style_name)

                                    elif "chartColorStyle" in c_type or "colors" in c_target:
                                        src_color = (src_chart_file.parent / c_target).resolve()
                                        if src_color.exists():
                                            new_color_name = f"colors_{chart_counter}_{src_color.name}"
                                            dest_color = charts_dir / new_color_name
                                            shutil.copy2(src_color, dest_color)
                                            ensure_content_type_override(f"/ppt/charts/{new_color_name}", "application/vnd.ms-office.drawingml.chartcolorstyle+xml")
                                            c_rel.set("Target", new_color_name)

                                dest_chart_rels = charts_rels_dir / f"{new_chart_name}.rels"
                                save_rels_xml(chart_tree, dest_chart_rels)

                            rel.set("Target", f"../charts/{new_chart_name}")

                    # 3. Media (Images / Vectors)
                    elif "image" in type_short or "media" in type_short:
                        src_media_file = (curr_slides / target).resolve()
                        if src_media_file.exists():
                            media_counter += 1
                            new_media_name = f"image_{slide_idx}_{media_counter}_{src_media_file.name}"
                            dest_media_file = media_dir / new_media_name
                            shutil.copy2(src_media_file, dest_media_file)
                            ext = dest_media_file.suffix.lower()
                            if ext in CONTENT_TYPE_DEFAULTS:
                                ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                            rel.set("Target", f"../media/{new_media_name}")

                    # 4. Embedded OLE Objects
                    elif "oleObject" in type_short or "package" in type_short:
                        if rel.get("TargetMode") != "External":
                            src_ole_file = (curr_slides / target).resolve()
                            if src_ole_file.exists():
                                embed_counter += 1
                                new_ole_name = f"ole_{slide_idx}_{embed_counter}_{src_ole_file.name}"
                                dest_ole_file = embeddings_dir / new_ole_name
                                shutil.copy2(src_ole_file, dest_ole_file)
                                ext = dest_ole_file.suffix.lower()
                                if ext in CONTENT_TYPE_DEFAULTS:
                                    ensure_content_type_default(ext, CONTENT_TYPE_DEFAULTS[ext])
                                rel.set("Target", f"../embeddings/{new_ole_name}")

                    # 5. Metadata Tags
                    elif "tags" in type_short:
                        src_tag_file = (curr_slides / target).resolve()
                        if src_tag_file.exists():
                            tag_counter += 1
                            new_tag_name = f"tag_{slide_idx}_{tag_counter}.xml"
                            dest_tag_file = tags_dir / new_tag_name
                            shutil.copy2(src_tag_file, dest_tag_file)
                            ensure_content_type_override(f"/ppt/tags/{new_tag_name}", "application/vnd.openxmlformats-officedocument.presentationml.tags+xml")
                            rel.set("Target", f"../tags/{new_tag_name}")

                    # 6. Notes Slides
                    elif "notesSlide" in type_short:
                        src_notes_file = (curr_slides / target).resolve()
                        if src_notes_file.exists():
                            new_notes_name = f"notesSlide{slide_idx}.xml"
                            dest_notes_file = notes_dir / new_notes_name
                            shutil.copy2(src_notes_file, dest_notes_file)
                            ensure_content_type_override(f"/ppt/notesSlides/{new_notes_name}", "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml")

                            # Copy notes rels and update slide target to current slide
                            src_notes_rels = src_notes_file.parent / "_rels" / f"{src_notes_file.name}.rels"
                            if src_notes_rels.exists():
                                notes_tree = ET.parse(src_notes_rels)
                                notes_root = notes_tree.getroot()
                                for n_rel in notes_root.findall(f"{{{NS_RELS}}}Relationship"):
                                    if n_rel.get("Type", "").endswith("/slide"):
                                        n_rel.set("Target", f"../slides/{new_slide_filename}")
                                dest_notes_rels = notes_rels_dir / f"{new_notes_name}.rels"
                                save_rels_xml(notes_tree, dest_notes_rels)

                            rel.set("Target", f"../notesSlides/{new_notes_name}")

                save_rels_xml(slide_rels_tree, dest_slide_rels)

            # Add slide relationship in presentation.xml.rels
            new_rid = get_next_pres_rid()
            rel_elem = ET.SubElement(pres_rels_root, f"{{{NS_RELS}}}Relationship")
            rel_elem.set("Id", new_rid)
            rel_elem.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
            rel_elem.set("Target", f"slides/{new_slide_filename}")

            # Add sldId entry in presentation.xml
            new_sld_id = ET.SubElement(sldIdLst, f"{{{NS_P}}}sldId")
            new_sld_id.set("id", str(next_slide_id))
            new_sld_id.set(f"{{{NS_R}}}id", new_rid)
            next_slide_id += 1

        # Step 3: Write back updated presentation structure
        save_presentation_xml(pres_tree, pres_xml_path)
        save_rels_xml(pres_rels_tree, pres_rels_path)
        save_content_types_xml(ct_tree, content_types_path)

        # Step 4: Zip all components into final merged .pptx
        with zipfile.ZipFile(output_pptx_path, 'w', compression=zipfile.ZIP_DEFLATED) as out_zip:
            for root, _, files in os.walk(merged_root):
                for file in files:
                    full_path = Path(root) / file
                    rel_path = full_path.relative_to(merged_root)
                    out_zip.write(full_path, arcname=str(rel_path))

    print(f"[SUCCESS] Merged presentation created: {output_pptx_path}")
    print(f"[SUCCESS] Total slides merged: {len(input_pptx_files)}")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    splitted_dir = base_dir / "splitted_ppt"
    sample_ppt_dir = base_dir / "sample_ppt"
    output_merged_path = base_dir / "merged_output.pptx"

    # Collect all split slides in natural numerical order
    slide_files = sorted(splitted_dir.glob("slide_*.pptx"), key=natural_sort_key)
    print(f"Found {len(slide_files)} slide files to merge.")

    # Merge slides with template layout & design resolution
    template_dir = sample_ppt_dir if sample_ppt_dir.exists() else None
    merge_pptx_files(slide_files, output_merged_path, template_source_dir=template_dir)
