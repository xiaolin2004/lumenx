"""Seedance video generation model adapter (via aiping proxy).

API:
  Submit:  POST {base_url}/videos
  Poll:    GET  {base_url}/videos/{task_id}
Auth: Bearer token (SEEDANCE_API_KEY)
Models: Doubao-Seedance-1.0-Pro-Fast, Doubao-Seedance-1.0-Lite, etc.
"""

import base64
import logging
import os
import time
from typing import Any, Dict, Optional, Tuple

import requests

from .base import VideoGenModel
from ..utils.endpoints import get_provider_base_url
from ..utils.oss_utils import OSSImageUploader
from ..utils.provider_media import resolve_media_input

logger = logging.getLogger(__name__)

_DEFAULT_BASE_URL = "https://aiping.cn/api/v1"
_DEFAULT_MODEL = "Doubao-Seedance-1.0-Pro-Fast"


class SeedanceModel(VideoGenModel):
    """Seedance I2V / T2V via aiping OpenAI-compatible REST API."""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key") or os.getenv("SEEDANCE_API_KEY", "")
        self.model_name = config.get("params", {}).get("model_name", _DEFAULT_MODEL)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _base_url(self) -> str:
        return get_provider_base_url("SEEDANCE", default=_DEFAULT_BASE_URL)

    def _auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _encode_local_image(self, path: str) -> str:
        """Encode a local image file to a base64 data-URI."""
        ext = os.path.splitext(path)[1].lower()
        mime = "image/png" if ext == ".png" else "image/jpeg"
        with open(path, "rb") as fh:
            data = base64.b64encode(fh.read()).decode()
        return f"data:{mime};base64,{data}"

    def _resolve_image(self, img_url: Optional[str], img_path: Optional[str]) -> Optional[str]:
        """Resolve image to base64 data-URI (local) or public URL (remote)."""
        if img_path and os.path.exists(img_path):
            return self._encode_local_image(img_path)

        if img_url:
            if img_url.startswith("file://"):
                local = img_url[7:]
                if os.path.exists(local):
                    return self._encode_local_image(local)

            try:
                resolved = resolve_media_input(
                    img_url,
                    model_name=self.model_name,
                    modality="image",
                    backend="vendor",
                    uploader=OSSImageUploader(),
                )
                return resolved.value
            except Exception as exc:
                logger.warning(f"[Seedance] Media resolution failed, using raw url: {exc}")
                return img_url

        return None

    def _extract_video_url(self, result: dict) -> Optional[str]:
        """Extract video URL from poll response (handle different field names)."""
        # Try common response shapes
        for key in ("video_url", "url"):
            if result.get(key):
                return result[key]
        # Nested: {"video": {"url": "..."}}
        video_obj = result.get("video")
        if isinstance(video_obj, dict):
            return video_obj.get("url")
        # Nested: {"output": {"url": "..."}}
        output_obj = result.get("output")
        if isinstance(output_obj, dict):
            return output_obj.get("url") or output_obj.get("video_url")
        return None

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def generate(
        self,
        prompt: str,
        output_path: str,
        img_url: Optional[str] = None,
        img_path: Optional[str] = None,
        **kwargs,
    ) -> Tuple[str, float]:
        """Generate video via Seedance API (T2V or I2V)."""
        model_name = kwargs.get("model") or self.model_name
        duration = kwargs.get("duration", 5)
        resolution = kwargs.get("resolution", "720p")
        aspect_ratio = kwargs.get("aspect_ratio", "16:9")

        is_i2v = bool(img_url or img_path)
        start_time = time.time()
        headers = self._auth_headers()
        base_url = self._base_url()

        # ---- Build request body --------------------------------------
        body: Dict[str, Any] = {
            "model": model_name,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "seconds": duration,
            "resolution": resolution,
        }

        if is_i2v:
            image_value = self._resolve_image(img_url, img_path)
            if image_value:
                body["image"] = image_value
            else:
                logger.warning("[Seedance] I2V requested but image could not be resolved; falling back to T2V")

        # ---- Submit task ---------------------------------------------
        submit_url = f"{base_url}/videos"
        logger.info(
            f"[Seedance] Submitting {'i2v' if (is_i2v and 'image' in body) else 't2v'} task "
            f"(model={model_name}, duration={duration}s, res={resolution})"
        )

        resp = requests.post(submit_url, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        task_id = data.get("id")
        if not task_id:
            raise RuntimeError(f"[Seedance] No task id in submit response: {data}")
        logger.info(f"[Seedance] Task submitted: {task_id}, initial status: {data.get('status')}")

        # ---- Poll for result -----------------------------------------
        poll_url = f"{base_url}/videos/{task_id}"
        max_wait = 600
        poll_interval = 5
        elapsed = 0

        while elapsed < max_wait:
            time.sleep(poll_interval)
            elapsed += poll_interval

            poll_resp = requests.get(poll_url, headers=self._auth_headers(), timeout=30)
            poll_resp.raise_for_status()
            result = poll_resp.json()

            status = result.get("status", "")
            logger.info(f"[Seedance] status={status} ({elapsed}s elapsed)")

            if status in ("completed", "succeeded"):
                video_url = self._extract_video_url(result)
                if not video_url:
                    raise RuntimeError(f"[Seedance] Task done but no video URL found: {result}")

                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                logger.info(f"[Seedance] Downloading from {video_url}")
                video_bytes = requests.get(video_url, timeout=300).content
                with open(output_path, "wb") as fh:
                    fh.write(video_bytes)

                elapsed_total = time.time() - start_time
                logger.info(f"[Seedance] Done in {elapsed_total:.1f}s → {output_path}")
                return output_path, elapsed_total

            elif status == "failed":
                error = result.get("error") or result.get("message") or result
                raise RuntimeError(f"[Seedance] Task failed: {error}")

        raise RuntimeError(f"[Seedance] Timed out after {max_wait}s (task_id={task_id})")
