"""Report object storage with a local development fallback."""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from app.core.config import settings


class ReportStorage:
    def __init__(self) -> None:
        self.bucket = settings.REPORTS_BUCKET
        self.local_root = Path(settings.REPORTS_STORAGE_DIR)

    @property
    def uses_s3(self) -> bool:
        return bool(self.bucket)

    def put(self, key: str, content: bytes) -> None:
        if self.uses_s3:
            self._s3().put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType="application/pdf",
                ServerSideEncryption="AES256",
            )
            return

        path = self.local_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def delete(self, key: str) -> None:
        if self.uses_s3:
            self._s3().delete_object(Bucket=self.bucket, Key=key)
            return
        (self.local_root / key).unlink(missing_ok=True)

    def stream(self, key: str) -> tuple[Iterator[bytes], int | None]:
        if self.uses_s3:
            try:
                response = self._s3().get_object(Bucket=self.bucket, Key=key)
            except Exception as exc:
                response_code = getattr(exc, "response", {}).get("Error", {}).get("Code")
                if response_code in {"NoSuchKey", "404", "NotFound"}:
                    raise FileNotFoundError(key) from exc
                raise
            body = response["Body"]

            def chunks() -> Iterator[bytes]:
                try:
                    yield from body.iter_chunks(chunk_size=64 * 1024)
                finally:
                    body.close()

            return chunks(), response.get("ContentLength")

        path = self.local_root / key
        if not path.exists():
            raise FileNotFoundError(key)

        def local_chunks() -> Iterator[bytes]:
            with path.open("rb") as handle:
                while chunk := handle.read(64 * 1024):
                    yield chunk

        return local_chunks(), path.stat().st_size

    @staticmethod
    def _s3():
        import boto3

        return boto3.client("s3", region_name=settings.AWS_REGION)


report_storage = ReportStorage()
