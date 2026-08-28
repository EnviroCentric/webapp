import base64
from datetime import date

import pytest

from app.services.air_reports import (
    AirReportPayload, AirSampleInput, calculate_report, decode_signature,
    render_report_pdf, safe_report_filename,
)


def payload(kind="personal", samples=None):
    return AirReportPayload(
        project_id=1,
        report_kind=kind,
        report_date="2025-07-12",
        formatted_address="916 Marcheta St, Altadena, CA 91001",
        google_place_id="test-place",
        worker_name="Anthony Soto" if kind == "personal" else None,
        technician_name="Brandale Robinson",
        analyst_user_id=1,
        analyzed_date="2025-07-14",
        samples=samples or [
            AirSampleInput(sample_number="A-01", description="Anthony Soto", sample_date="2025-07-12", start="08:22", end="08:52", flow_rate=2, fibers=9.5, fields=100),
            AirSampleInput(sample_number="A-02", description="Anthony Soto", sample_date="2025-07-12", start="08:54", end="14:22", flow_rate=2, fibers=8, fields=100),
            AirSampleInput(sample_number="A-03", description="Field Blank", sample_date="2025-07-12", fibers=0, fields=100, is_blank=True, blank_type="Field Blank"),
            AirSampleInput(sample_number="A-04", description="Lab Blank", sample_date="2025-07-12", fibers=4, fields=100, is_blank=True, blank_type="Lab Blank"),
        ],
    )


def required_blanks():
    return [
        AirSampleInput(sample_number="B-F", description="Field Blank", sample_date="2025-01-01", fibers=0, fields=100, is_blank=True, blank_type="Field Blank"),
        AirSampleInput(sample_number="B-L", description="Lab Blank", sample_date="2025-01-01", fibers=0, fields=100, is_blank=True, blank_type="Lab Blank"),
    ]


def test_calculations_match_excel_reference():
    report = calculate_report(payload())
    first, second = report["samples"][:2]
    assert first["total_minutes"] == 30
    assert first["volume"] == 60
    assert first["fiber_density"] == pytest.approx(12.1019108)
    assert first["fiber_concentration"] == pytest.approx(0.077654)
    assert second["total_minutes"] == 328
    assert second["volume"] == 656
    assert report["field_blank_average_fibers"] == 0
    assert report["twa"] == pytest.approx(0.0089, abs=0.00005)


def test_averages_only_field_blank_fibers():
    samples = [
        AirSampleInput(sample_number="S-1", description="Area", sample_date="2025-01-01", start="08:00", end="09:00", flow_rate=2, fibers=10, fields=100),
        AirSampleInput(sample_number="B-1", description="Field Blank", sample_date="2025-01-01", fibers=2, fields=50, is_blank=True, blank_type="Field Blank"),
        AirSampleInput(sample_number="B-2", description="Field Blank", sample_date="2025-01-01", fibers=4, fields=100, is_blank=True, blank_type="Field Blank"),
        AirSampleInput(sample_number="L-1", description="Lab Blank", sample_date="2025-01-01", fibers=99, fields=100, is_blank=True, blank_type="Lab Blank"),
    ]
    report = calculate_report(payload("area", samples))
    assert report["field_blank_average_fibers"] == 3
    assert report["samples"][0]["fiber_density"] == pytest.approx(((10/100)-(3/100))/0.00785)
    assert report["twa"] is None


def test_rejects_invalid_time_and_duplicate_ids():
    with pytest.raises(ValueError, match="later"):
        calculate_report(payload("area", [
            AirSampleInput(sample_number="S-1", description="Area", sample_date="2025-01-01", start="09:00", end="08:00", flow_rate=2, fibers=1, fields=100),
            *required_blanks(),
        ]))
    with pytest.raises(ValueError, match="unique"):
        payload("area", [
            AirSampleInput(sample_number="S-1", description="A", sample_date="2025-01-01", start="08:00", end="09:00", flow_rate=2, fibers=1, fields=100),
            AirSampleInput(sample_number="s-1", description="B", sample_date="2025-01-01", start="09:00", end="10:00", flow_rate=2, fibers=1, fields=100),
            *required_blanks(),
        ])


def test_signature_filename_and_pdf():
    png = b"\x89PNG\r\n\x1a\n"
    encoded = "data:image/png;base64," + base64.b64encode(png).decode()
    assert decode_signature(encoded) == png
    assert safe_report_filename("916 Marcheta St, Altadena", "2025-07-12") == "916 Marcheta St - 07-12-2025.pdf"
    report = calculate_report(payload())
    pdf = render_report_pdf(
        report, client_name="AMPCO Contracting, Inc",
        client_address="117991 Cowan, Irvine, CA 92614",
        project_name="California Wildfires", analyst_name="Enrique Esparza",
        signature_bytes=None,
    )
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 2000
