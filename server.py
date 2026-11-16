"""Local editor server with an Apache/MIT licensed HWP conversion tool."""

import json
import os
import re
import subprocess
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MAX_UPLOAD = 10 * 1024 * 1024
HWP_MAGIC = bytes.fromhex("d0cf11e0a1b11ae1")
HWP3_MAGIC = b"HWP Document File"
HWP_TOOL = Path(os.environ.get("HWP_TOOL", ROOT / "vendor" / "hwp"))


def detect_hwp_format(data: bytes) -> str | None:
    if data.startswith(HWP_MAGIC):
        return "hwp5"
    if data.startswith(HWP3_MAGIC):
        return "hwp3"
    return None


def convert_hwp(source: Path, folder: Path) -> tuple[str, str]:
    if not HWP_TOOL.is_file():
        raise FileNotFoundError(f"HWP 변환 도구를 찾을 수 없습니다: {HWP_TOOL}")
    html_path = folder / "document.html"
    subprocess.run(
        [str(HWP_TOOL), "convert", str(source), "-o", str(html_path)],
        check=True, capture_output=True, timeout=30,
    )
    preview = subprocess.run(
        [str(HWP_TOOL), "cat", "--preview", str(source)],
        check=True, capture_output=True, text=True, timeout=30,
    )
    return html_path.read_text(encoding="utf-8"), preview.stdout


def convert_hwp3(source: Path, folder: Path) -> dict[str, object]:
    output = folder / "document.json"
    command = ["node", str(ROOT / "hwp3-convert.mjs"), str(source), str(output)]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if completed.returncode:
        lines = [line.strip() for line in completed.stderr.splitlines() if line.strip()]
        reason = next((line for line in lines if not line.startswith((
            "node:", "triggerUncaughtException(", "^", "(Use `node", "Node.js v",
        ))), "변환기가 종료됐습니다.")
        raise ValueError(reason[:200])
    result = json.loads(output.read_text(encoding="utf-8"))
    html = result.get("html")
    count = result.get("table_count")
    if (result.get("format") != "hwp3" or not isinstance(html, str) or not html
            or not isinstance(count, int) or count < 0
            or len(re.findall(r"<table\b", html, re.I)) != count):
        raise ValueError("변환 결과의 형식이나 표 개수가 맞지 않습니다.")
    return result


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path != "/api/import-hwp":
            self.send_json(404, {"error": "요청한 주소를 찾을 수 없습니다."})
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            size = 0
        if size <= 0 or size > MAX_UPLOAD:
            self.send_json(413, {"error": "HWP 파일은 10MB 이하만 가져올 수 있습니다."})
            return

        data = self.rfile.read(size)
        file_format = detect_hwp_format(data)
        if not file_format:
            self.send_json(400, {"error": "HWP 5 또는 HWP 3.0 형식의 파일을 선택해 주세요."})
            return

        with tempfile.TemporaryDirectory(prefix="hwp-import-") as temporary:
            folder = Path(temporary)
            source = folder / "document.hwp"
            source.write_bytes(data)
            try:
                if file_format == "hwp3":
                    result = convert_hwp3(source, folder)
                else:
                    html, preview_text = convert_hwp(source, folder)
                    result = {"html": html, "preview_text": preview_text, "format": "hwp5", "warnings": []}
            except (OSError, ValueError, UnicodeError, json.JSONDecodeError,
                    subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                detail = f": {error}" if file_format == "hwp3" and isinstance(error, ValueError) else ""
                self.send_json(422, {"error": f"HWP {('3.0 시험' if file_format == 'hwp3' else '5')} 변환에 실패했습니다{detail}."})
                return

        self.send_json(200, result)


if __name__ == "__main__":
    print("http://127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), partial(Handler, directory=str(ROOT))).serve_forever()
