"""Air-sample report calculations and PDF rendering."""
from __future__ import annotations

import base64
import io
import os
import re
from datetime import datetime
from pathlib import Path
from statistics import mean
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, PageTemplate, Paragraph,
    Spacer, Table, TableStyle,
)

Z = 0.00785
EFFECTIVE_AREA = 385
TWA_MINUTES = 480


class AirSampleInput(BaseModel):
    sample_number: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=255)
    sample_date: str
    start: str | None = None
    end: str | None = None
    flow_rate: float | None = Field(default=None, gt=0)
    fibers: float | None = Field(default=None, ge=0)
    fields: int | None = Field(default=None, gt=0)
    is_blank: bool = False
    blank_type: str | None = None
    status: str = Field(default="normal", pattern="^(normal|overload|damaged|rejected)$")
    reject_note: str | None = None

    @field_validator("start", "end")
    @classmethod
    def validate_time(cls, value: str | None):
        if value is None or value == "":
            return None
        try:
            datetime.strptime(value, "%H:%M")
        except ValueError as exc:
            raise ValueError("Time must use 24-hour HH:MM format") from exc
        return value

    @model_validator(mode="after")
    def validate_kind(self):
        if self.is_blank:
            if self.blank_type not in ("Field Blank", "Lab Blank"):
                raise ValueError("Blank samples require Field Blank or Lab Blank type")
            if self.fields is None:
                raise ValueError("Blank samples require fields")
        elif self.status == "normal":
            required = (self.start, self.end, self.flow_rate, self.fibers, self.fields)
            if any(v is None for v in required):
                raise ValueError("Normal samples require start, end, flow rate, fibers, and fields")
        elif self.status == "rejected" and not (self.reject_note or "").strip():
            raise ValueError("Rejected samples require a reason")
        return self


class AirReportPayload(BaseModel):
    project_id: int
    report_kind: str = Field(pattern="^(area|clearance|personal)$")
    report_date: str
    formatted_address: str = Field(min_length=1)
    google_place_id: str = Field(min_length=1)
    latitude: float | None = None
    longitude: float | None = None
    location_label: str | None = None
    worker_name: str | None = None
    technician_user_id: int | None = None
    technician_name: str = Field(min_length=1)
    analyst_user_id: int
    analyzed_date: str
    analytical_procedure: str = "NIOSH 7400 PCM*"
    project_additional_info: str | None = None
    notes: str | None = None
    samples: list[AirSampleInput] = Field(min_length=1)
    signature_data_url: str | None = None
    save_signature_as_default: bool = False

    @model_validator(mode="after")
    def validate_report(self):
        ids = [s.sample_number.strip().lower() for s in self.samples]
        if len(ids) != len(set(ids)):
            raise ValueError("Sample numbers must be unique")
        if self.report_kind == "personal" and not (self.worker_name or "").strip():
            raise ValueError("Personal reports require a worker/person name")
        if not any(not s.is_blank for s in self.samples):
            raise ValueError("At least one non-blank sample is required")
        blank_types = {s.blank_type for s in self.samples if s.is_blank}
        if not {"Field Blank", "Lab Blank"}.issubset(blank_types):
            raise ValueError("Every report requires one Field Blank and one Lab Blank")
        return self


def _minutes(start: str, end: str) -> int:
    a = datetime.strptime(start, "%H:%M")
    b = datetime.strptime(end, "%H:%M")
    result = int((b - a).total_seconds() / 60)
    if result <= 0:
        raise ValueError("Sample end time must be later than start time")
    return result


def calculate_report(payload: AirReportPayload) -> dict[str, Any]:
    field_blank_fibers = [
        s.fibers or 0 for s in payload.samples
        if s.is_blank and s.blank_type == "Field Blank" and s.fibers is not None
    ]
    blank_average = mean(field_blank_fibers) if field_blank_fibers else 0.0
    rows: list[dict[str, Any]] = []
    weighted = 0.0

    for sample in payload.samples:
        row = sample.model_dump()
        if sample.is_blank:
            density = ((sample.fibers or 0) / sample.fields) / Z
            row.update(total_minutes=None, volume=None, fiber_density=density, fiber_concentration=None)
        elif sample.status != "normal":
            row.update(total_minutes=None, volume=None, fiber_density=None, fiber_concentration=None)
        else:
            minutes = _minutes(sample.start, sample.end)
            volume = sample.flow_rate * minutes
            density = ((sample.fibers / sample.fields) - (blank_average / sample.fields)) / Z
            concentration = (density * EFFECTIVE_AREA) / (volume * 1000)
            row.update(
                total_minutes=minutes,
                volume=volume,
                fiber_density=density,
                fiber_concentration=concentration,
            )
            weighted += concentration * minutes
        rows.append(row)

    return {
        **payload.model_dump(exclude={"signature_data_url", "save_signature_as_default"}),
        "samples": rows,
        "field_blank_average_fibers": blank_average,
        "twa": weighted / TWA_MINUTES if payload.report_kind == "personal" else None,
    }


def decode_signature(data_url: str | None) -> bytes | None:
    if not data_url:
        return None
    match = re.fullmatch(r"data:image/(?:png|jpeg);base64,([A-Za-z0-9+/=\s]+)", data_url)
    if not match:
        raise ValueError("Signature must be a PNG or JPEG data URL")
    value = base64.b64decode(match.group(1), validate=True)
    if len(value) > 1_000_000:
        raise ValueError("Signature image is too large")
    return value


def safe_report_filename(address: str, report_date: str) -> str:
    street = address.split(",")[0].strip() or "Air Sample Report"
    date_value = datetime.strptime(report_date[:10], "%Y-%m-%d").strftime("%m-%d-%Y")
    base = re.sub(r'[^A-Za-z0-9 ._-]', "_", f"{street} - {date_value}").strip(" .")
    return f"{base}.pdf"


def _short_date(value: str) -> str:
    parsed = datetime.strptime(value[:10], "%Y-%m-%d")
    return f"{parsed.month}/{parsed.day}/{str(parsed.year)[2:]}"


def _title_case(value: str | None) -> str:
    """Apply report display casing without altering the stored source value."""
    return (value or "").strip().title()


def render_report_pdf(
    report: dict[str, Any],
    *,
    client_name: str,
    client_address: str,
    project_name: str,
    analyst_name: str,
    signature_bytes: bytes | None,
) -> bytes:
    """Render an Excel-like, letter-landscape report."""
    out = io.BytesIO()
    page_w, page_h = landscape(letter)
    doc = BaseDocTemplate(
        out, pagesize=(page_w, page_h),
        leftMargin=0.24 * inch, rightMargin=0.24 * inch,
        topMargin=0.42 * inch, bottomMargin=0.25 * inch,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="report", leftPadding=0, rightPadding=0)
    def continued_header(canvas, _doc):
        if canvas.getPageNumber() > 1:
            canvas.saveState()
            canvas.setFont("Helvetica-Bold", 7)
            canvas.drawString(doc.leftMargin, page_h - 0.16 * inch, f'AIR SAMPLE REPORT - {report["formatted_address"]}')
            canvas.restoreState()
    doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=continued_header))
    normal = ParagraphStyle("normal", fontName="Helvetica", fontSize=9.3, leading=10.5, alignment=TA_LEFT)
    tiny = ParagraphStyle("tiny", parent=normal, fontSize=7.7, leading=8.7)
    footer_style = ParagraphStyle("footer", parent=normal, fontSize=7.5, leading=8.8)
    center = ParagraphStyle("center", parent=normal, alignment=TA_CENTER)
    bold = ParagraphStyle("bold", parent=normal, fontName="Helvetica-Bold")

    logo_candidates = [
        Path(os.getenv("REPORT_LOGO_PATH", "/app/frontend-assets/enviro-centric.jpg")),
        Path(__file__).parents[3] / "frontend" / "src" / "assets" / "enviro-centric.jpg",
    ]
    logo_path = next((path for path in logo_candidates if path.exists()), None)
    logo = Image(str(logo_path), width=2.28 * inch, height=1.00 * inch) if logo_path else Paragraph("<b>ENVIROCENTRIC</b>", center)
    company = Paragraph("ENVIROCENTRIC, INC<br/>P.O. Box 122202<br/>Chula Vista, CA 91912", ParagraphStyle("company", parent=center, fontSize=13.5, leading=15))
    header = Table([[logo, company, ""]], colWidths=[2.5 * inch, 5.5 * inch, 2.5 * inch], rowHeights=[1.03 * inch])
    header.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "MIDDLE")]))
    story = [header, Paragraph("<b>AIR SAMPLE REPORT</b>", ParagraphStyle("title", parent=center, fontSize=14.5, leading=16)), Spacer(1, 4)]

    client_lines = "<br/>".join(filter(None, [_title_case(client_name), client_address]))
    project_lines = "<br/>".join(filter(None, [_title_case(project_name), report["formatted_address"], report.get("project_additional_info")]))
    info = Table([[
        Paragraph("<b>Client:</b>", bold), Paragraph(client_lines, normal),
        Paragraph("<b>Project:</b>", bold), Paragraph(project_lines, normal),
        Paragraph("<b>Analytical Procedure:</b><br/><b>Number of Samples:</b><br/><b>Technician:</b>", bold),
        Paragraph(f'{report["analytical_procedure"]}<br/>{len(report["samples"])}<br/>{_title_case(report["technician_name"])}', normal),
    ]], colWidths=[0.78*inch, 2.55*inch, 0.85*inch, 2.28*inch, 2.12*inch, 1.92*inch])
    info.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.8, colors.black), ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 3), ("RIGHTPADDING", (0,0), (-1,-1), 3),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    story.extend([info, Paragraph("* Fiber count by Phase Contrast Microscopy (PCM), NIOSH 7400 Method - A Rules, Revision 3, Issue 3, 6/14/2019 (with 8 Hour Time Weighted Average)", normal), Spacer(1, 7)])

    headers = ["Sample", "Description", "Date", "Sample Start", "Sample End", "Flow Rate<br/>(L/min)", "Total<br/>Minutes", "Volume<br/>(L)", "Fibers<br/>(#)", "Fields<br/>(#)", "Fiber Density<br/>(f/mm^2)", "Fiber Concentration<br/>(f/cc)"]
    # Keep every shaded table row aligned with the 10.5-inch report header
    # and TWA bar. The previous 9.88-inch total caused these rows to be
    # centered with mismatched left and right edges.
    widths = [0.80, 1.82, 0.88, 0.91, 0.89, 0.91, 0.63, 0.59, 0.47, 0.47, 0.93, 1.20]

    def fmt(value, digits=4):
        if value is None: return "-"
        if isinstance(value, float): return f"{value:.{digits}f}"
        return str(value)

    def section(title: str, rows: list[dict[str, Any]]):
        data = [[Paragraph(f"<b>{title}</b>", tiny)] + [""] * 11, [Paragraph(x, tiny) for x in headers]]
        for row in rows:
            rejected = row["status"] != "normal"
            description = row.get("reject_note") if row["status"] == "rejected" else _title_case(row["description"])
            values = [
                row["sample_number"], description, _short_date(row["sample_date"]),
                row.get("start") or "-", row.get("end") or "-", fmt(row.get("flow_rate"), 2) if not row["is_blank"] else "-",
                fmt(row.get("total_minutes"), 0), fmt(row.get("volume"), 2),
                (row["status"].title() if rejected else fmt(row.get("fibers"), 1)),
                ("-" if rejected else fmt(row.get("fields"), 0)),
                fmt(row.get("fiber_density")), fmt(row.get("fiber_concentration")),
            ]
            data.append([Paragraph(str(value or ""), tiny) for value in values])
        table = Table(data, colWidths=[x*inch for x in widths], repeatRows=2, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("SPAN", (0,0), (-1,0)), ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#d4d4d4")),
            ("BACKGROUND", (0,1), (-1,1), colors.HexColor("#eeeeee")),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTNAME", (0,1), (-1,1), "Helvetica"),
            ("FONTSIZE", (0,0), (-1,-1), 7.7), ("LEADING", (0,0), (-1,-1), 8.7),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("ALIGN", (0,0), (-1,-1), "LEFT"),
            ("LEFTPADDING", (0,0), (-1,-1), 2), ("RIGHTPADDING", (0,0), (-1,-1), 2),
            ("TOPPADDING", (0,0), (-1,-1), 2.7), ("BOTTOMPADDING", (0,0), (-1,-1), 2.7),
        ]))
        return table

    samples = [r for r in report["samples"] if not r["is_blank"]]
    blanks = [r for r in report["samples"] if r["is_blank"]]
    story.append(section("Samples", samples))
    if blanks:
        story.extend([Spacer(1, 8), section("Blank Samples", blanks)])
    if report.get("twa") is not None:
        twa = Table([[Paragraph("<b>Time Weighted Average:</b>", center), Paragraph(f'{report["twa"]:.4f} f/cc', normal)]], colWidths=[5.55*inch, 4.95*inch])
        twa.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#d4d4d4")),("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2)]))
        story.extend([Spacer(1, 8), twa])
    story.append(Spacer(1, 62))

    sig = Image(io.BytesIO(signature_bytes), width=1.45*inch, height=0.46*inch) if signature_bytes else ""
    sig_table = Table([[
        Paragraph("<b>Analyzed by:</b>", normal), Paragraph(_title_case(analyst_name), normal),
        Paragraph("<b>Signature:</b>", normal), sig,
        Paragraph("<b>Date:</b>", normal), Paragraph(datetime.strptime(report["analyzed_date"][:10], "%Y-%m-%d").strftime("%m/%d/%y"), normal),
    ]], colWidths=[1.15*inch,2.6*inch,0.88*inch,2.0*inch,0.6*inch,1.1*inch])
    sig_table.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    footer = [
        Paragraph("<b>BLD = BELOW LIMIT OF DETECTION</b>", footer_style),
        Spacer(1, 10),
        Paragraph("EnviroCentric, Inc. is enrolled in the AIHA PAT program for airborne asbestos. PAT ID 1134110.<br/>Samples were analyzed in accordance with the NIOSH 7400 \"A\" rules method by a NIOSH 582 certified analyst.<br/>Samples are corrected by the average of blanks, unless blank count above 5.5 fibers. Results are generated from the field data such sampling volumes and areas, locations, etc. provided by the customer on the chain of custody. Samples are within the quality control criteria and met method specifications unless otherwise noted. Limit of detection is 7 fibers/mm^2. NIOSH 7400 requires field blanks be submitted at a rate of 10% with a minimum of 2 per set.", footer_style),
    ]
    story.extend([KeepTogether([sig_table, Spacer(1, 16), *footer])])
    doc.build(story)
    return out.getvalue()
